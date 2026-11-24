/* ============================================================================
 * app.js — UI state, events and wiring
 * ----------------------------------------------------------------------------
 * Consumes:
 *   UzTransliterator  (js/transliterator.js)  — linguistic engine
 *   I18N              (js/i18n.js)            — UZ / EN / RU localisation
 *   UzFileHandler     (js/file-handler.js)    — client-side document pipeline
 * ==========================================================================*/
(function () {
  "use strict";

  var Transliterator = window.UzTransliterator;
  var I18N = window.I18N;
  var FileHandler = window.UzFileHandler;

  var DEBOUNCE_MS = 180;
  var TOAST_DURATION = 2600;

  var SCRIPT_LABEL_KEY = {
    cyrl: "scriptCyrl",
    lat: "scriptLat",
    new: "scriptNew",
  };

  /* ---------------------------------------------------------------------- */
  /* DOM references                                                          */
  /* ---------------------------------------------------------------------- */

  var dom = {
    themeToggle: document.getElementById("themeToggle"),
    langButtons: Array.prototype.slice.call(
      document.querySelectorAll(".lang-switch__btn"),
    ),

    tabs: Array.prototype.slice.call(document.querySelectorAll(".tabs__tab")),
    panels: {
      text: document.getElementById("panel-text"),
      document: document.getElementById("panel-document"),
    },

    sourceScript: document.getElementById("sourceScript"),
    targetScript: document.getElementById("targetScript"),
    swapBtn: document.getElementById("swapBtn"),
    sameScriptNote: document.getElementById("sameScriptNote"),

    sourceText: document.getElementById("sourceText"),
    targetText: document.getElementById("targetText"),

    stats: {
      source: {
        chars: document.getElementById("sourceChars"),
        words: document.getElementById("sourceWords"),
        lines: document.getElementById("sourceLines"),
      },
      target: {
        chars: document.getElementById("targetChars"),
        words: document.getElementById("targetWords"),
        lines: document.getElementById("targetLines"),
      },
    },

    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    progressWrap: document.getElementById("progressWrap"),
    progressFill: document.getElementById("progressFill"),
    progressLabel: document.getElementById("progressLabel"),
    resultsList: document.getElementById("resultsList"),
    resultsEmpty: document.getElementById("resultsEmpty"),

    toastStack: document.getElementById("toastStack"),
  };

  /* ---------------------------------------------------------------------- */
  /* State                                                                   */
  /* ---------------------------------------------------------------------- */

  /* Which pane the user is currently typing in — it drives transliteration. */
  var activePane = "source";
  var isSyncing = false;
  var debounceTimers = { source: null, target: null };

  /* Document-mode state */
  var results = []; /* rendered rows */
  var downloads = {}; /* id -> { blob, filename } */
  var fileQueue = [];
  var isProcessing = false;
  var downloadSeq = 0;

  /* ---------------------------------------------------------------------- */
  /* Small utilities                                                         */
  /* ---------------------------------------------------------------------- */

  function scriptLabel(script) {
    return I18N.t(SCRIPT_LABEL_KEY[script] || "scriptCyrl");
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function transliterateText(text, from, to) {
    return Transliterator.transliterate(text, from, to);
  }

  /* ---------------------------------------------------------------------- */
  /* Theme (respects prefers-color-scheme, persisted in localStorage)        */
  /* ---------------------------------------------------------------------- */

  function initTheme() {
    var current =
      document.documentElement.getAttribute("data-theme") || "light";
    dom.themeToggle.setAttribute("aria-pressed", String(current === "dark"));
  }

  function toggleTheme() {
    var next =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", next);
    dom.themeToggle.setAttribute("aria-pressed", String(next === "dark"));
    try {
      localStorage.setItem("uztr.theme", next);
    } catch (e) {
      /* storage unavailable — theme simply won't persist */
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Language                                                                */
  /* ---------------------------------------------------------------------- */

  function initLanguage() {
    I18N.initLang();
    syncLangButtons();
    I18N.applyTranslations(document);
  }

  function syncLangButtons() {
    var active = I18N.getLang();
    dom.langButtons.forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.lang === active),
      );
    });
  }

  function setLanguage(lang) {
    I18N.setLang(lang);
    syncLangButtons();
    renderResults();
    updateProgressLabel();
  }

  /* ---------------------------------------------------------------------- */
  /* Tabs                                                                    */
  /* ---------------------------------------------------------------------- */

  function activateTab(name) {
    dom.tabs.forEach(function (tab) {
      var isActive = tab.dataset.tab === name;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
    Object.keys(dom.panels).forEach(function (key) {
      dom.panels[key].hidden = key !== name;
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Text mode                                                               */
  /* ---------------------------------------------------------------------- */

  function countWords(text) {
    var trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  function updateStats(pane) {
    var value = pane === "source" ? dom.sourceText.value : dom.targetText.value;
    var target = dom.stats[pane];
    target.chars.textContent = String(value.length);
    target.words.textContent = String(countWords(value));
    target.lines.textContent = String(value ? value.split("\n").length : 0);
  }

  function currentScripts() {
    return {
      from: dom.sourceScript.value,
      to: dom.targetScript.value,
    };
  }

  /**
   * Transliterate from the edited pane into the other pane.
   * @param {string} fromPane 'source' | 'target'
   */
  function syncPanes(fromPane) {
    if (isSyncing) return;

    var scripts = currentScripts();
    var input;
    var output;

    isSyncing = true;
    if (fromPane === "source") {
      input = dom.sourceText.value;
      output = transliterateText(input, scripts.from, scripts.to);
      if (dom.targetText.value !== output) dom.targetText.value = output;
    } else {
      input = dom.targetText.value;
      output = transliterateText(input, scripts.to, scripts.from);
      if (dom.sourceText.value !== output) dom.sourceText.value = output;
    }
    isSyncing = false;

    updateStats("source");
    updateStats("target");
    updateSameScriptNotice();
  }

  function scheduleSync(pane) {
    activePane = pane;
    if (debounceTimers[pane]) clearTimeout(debounceTimers[pane]);
    debounceTimers[pane] = setTimeout(function () {
      debounceTimers[pane] = null;
      syncPanes(pane);
    }, DEBOUNCE_MS);
  }

  function updateSameScriptNotice() {
    dom.sameScriptNote.hidden =
      dom.sourceScript.value !== dom.targetScript.value;
  }

  function swapScriptsAndText() {
    var source = dom.sourceScript.value;

    dom.sourceScript.value = dom.targetScript.value;
    dom.targetScript.value = source;

    var sourceText = dom.sourceText.value;
    dom.sourceText.value = dom.targetText.value;
    dom.targetText.value = sourceText;

    /* The source pane now holds text in the (new) source script — re-derive. */
    syncPanes("source");
    toast(I18N.t("toastSwapped"), "success");
  }

  function insertExample() {
    var script = dom.sourceScript.value;
    dom.sourceText.value = I18N.EXAMPLES[script] || I18N.EXAMPLES.lat;
    activePane = "source";
    syncPanes("source");
  }

  /* ---------------------------------------------------------------------- */
  /* Clipboard                                                               */
  /* ---------------------------------------------------------------------- */

  function copyTextFrom(pane) {
    var textarea = pane === "source" ? dom.sourceText : dom.targetText;
    var text = textarea.value;

    function fallbackCopy() {
      textarea.focus();
      textarea.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      window.getSelection().removeAllRanges();
      if (ok) toast(I18N.t("toastCopied"), "success");
      else toast(I18N.t("toastCopyError"), "error");
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          toast(I18N.t("toastCopied"), "success");
        })
        .catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  function pasteInto(pane) {
    var textarea = pane === "source" ? dom.sourceText : dom.targetText;

    function apply(text) {
      var start = textarea.selectionStart;
      var end = textarea.selectionEnd;
      textarea.value =
        textarea.value.slice(0, start) + text + textarea.value.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
      syncPanes(pane);
      toast(I18N.t("toastPasted"), "success");
    }

    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard
        .readText()
        .then(apply)
        .catch(function () {
          toast(I18N.t("toastPasteError"), "error");
          textarea.focus();
        });
    } else {
      toast(I18N.t("toastPasteError"), "error");
      textarea.focus();
    }
  }

  function clearPane(pane) {
    var textarea = pane === "source" ? dom.sourceText : dom.targetText;
    textarea.value = "";
    activePane = pane;
    syncPanes(pane);
    textarea.focus();
    toast(I18N.t("toastCleared"), "success");
  }

  function handlePaneAction(pane, action) {
    switch (action) {
      case "copy":
        copyTextFrom(pane);
        break;
      case "paste":
        pasteInto(pane);
        break;
      case "clear":
        clearPane(pane);
        break;
      case "example":
        insertExample();
        break;
      default:
        break;
    }
  }

  function handleScriptChange() {
    updateSameScriptNotice();
    syncPanes(activePane);
  }

  /* ---------------------------------------------------------------------- */
  /* Toasts                                                                  */
  /* ---------------------------------------------------------------------- */

  function toast(message, type) {
    var node = document.createElement("div");
    node.className = "toast" + (type ? " toast--" + type : "");
    node.textContent = message;
    dom.toastStack.appendChild(node);

    requestAnimationFrame(function () {
      node.classList.add("is-visible");
    });

    setTimeout(function () {
      node.classList.remove("is-visible");
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 250);
    }, TOAST_DURATION);
  }

  /* ---------------------------------------------------------------------- */
  /* Document mode: results rendering                                        */
  /* ---------------------------------------------------------------------- */

  function addResult(entry) {
    entry.id = "r" + ++downloadSeq;
    results.push(entry);
    renderResults();
    return entry;
  }

  function findResult(id) {
    for (var i = 0; i < results.length; i++) {
      if (results[i].id === id) return results[i];
    }
    return null;
  }

  function renderResults() {
    dom.resultsList.textContent = "";

    results.forEach(function (entry) {
      var item = document.createElement("li");
      item.className =
        "result-item result-item--" +
        (entry.errorKey
          ? "error"
          : entry.statusKey === "statusDone"
            ? "done"
            : "pending");

      var icon = document.createElement("span");
      icon.className = "result-item__icon";
      icon.textContent = (entry.ext || "").slice(0, 4) || "FILE";
      item.appendChild(icon);

      var body = document.createElement("div");
      body.className = "result-item__body";

      var name = document.createElement("span");
      name.className = "result-item__name";
      name.textContent = entry.name;
      body.appendChild(name);

      var meta = document.createElement("span");
      meta.className = "result-item__meta";
      meta.textContent = buildMeta(entry);
      body.appendChild(meta);

      item.appendChild(body);

      if (entry.downloadId && downloads[entry.downloadId]) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn--ghost result-item__action";
        button.textContent = I18N.t("btnDownload");
        button.addEventListener("click", function () {
          deliverDownload(entry.downloadId);
        });
        item.appendChild(button);
      }

      dom.resultsList.appendChild(item);
    });

    dom.resultsEmpty.hidden = results.length > 0;
  }

  function buildMeta(entry) {
    if (entry.errorKey) {
      return I18N.t(entry.errorKey, entry.errorVars || {});
    }

    var parts = [
      scriptLabel(entry.from) + " → " + scriptLabel(entry.to),
      formatBytes(entry.size),
    ];

    var status = I18N.t(entry.statusKey || "statusQueued");
    if (entry.percent !== undefined && entry.statusKey !== "statusDone") {
      status += " · " + entry.percent + "%";
    }
    parts.push(status);

    if (entry.noteKey) parts.push(I18N.t(entry.noteKey));

    return parts.filter(Boolean).join(" · ");
  }

  function deliverDownload(id) {
    var payload = downloads[id];
    if (!payload) return;

    var url = URL.createObjectURL(payload.blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = payload.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);

    toast(I18N.t("toastDownloaded", { name: payload.filename }), "success");
  }

  /* ---------------------------------------------------------------------- */
  /* Document mode: progress                                                 */
  /* ---------------------------------------------------------------------- */

  var progressState = {
    visible: false,
    percent: 0,
    name: "",
    statusKey: "statusReading",
  };

  function updateProgressLabel() {
    if (!progressState.visible) return;
    dom.progressLabel.textContent = progressState.name
      ? progressState.name +
        " — " +
        I18N.t(progressState.statusKey) +
        " · " +
        progressState.percent +
        "%"
      : I18N.t(progressState.statusKey);
  }

  function showProgress(visible) {
    progressState.visible = visible;
    dom.progressWrap.hidden = !visible;
    if (!visible) {
      progressState.percent = 0;
      dom.progressFill.style.width = "0%";
      dom.progressWrap.setAttribute("aria-valuenow", "0");
      dom.progressLabel.textContent = "";
    }
  }

  function setProgress(percent, statusKey, name) {
    progressState.percent = Math.max(0, Math.min(100, percent));
    if (statusKey) progressState.statusKey = statusKey;
    if (name !== undefined) progressState.name = name;
    dom.progressFill.style.width = progressState.percent + "%";
    dom.progressWrap.setAttribute(
      "aria-valuenow",
      String(progressState.percent),
    );
    updateProgressLabel();
  }

  /* ---------------------------------------------------------------------- */
  /* Document mode: queue                                                    */
  /* ---------------------------------------------------------------------- */

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    var scripts = currentScripts();
    activateTab("document");

    files.forEach(function (file) {
      var validation = FileHandler.validate(file);
      var ext = FileHandler.getExtension(file.name);

      if (!validation.ok) {
        addResult({
          name: file.name,
          ext: ext,
          size: file.size,
          from: scripts.from,
          to: scripts.to,
          errorKey: validation.errorKey,
          errorVars: validation.vars,
        });
        return;
      }

      var entry = addResult({
        name: file.name,
        ext: ext,
        size: file.size,
        from: scripts.from,
        to: scripts.to,
        statusKey: "statusQueued",
        percent: 0,
      });

      fileQueue.push({ file: file, entry: entry, scripts: scripts });
    });

    processQueue();
  }

  function processQueue() {
    if (isProcessing || !fileQueue.length) {
      if (!isProcessing && !fileQueue.length) showProgress(false);
      return;
    }

    isProcessing = true;
    var job = fileQueue.shift();
    var translit = function (text) {
      return transliterateText(text, job.scripts.from, job.scripts.to);
    };

    showProgress(true);
    setProgress(2, "statusReading", job.entry.name);

    FileHandler.convertFile(job.file, translit, function (percent, statusKey) {
      setProgress(percent, statusKey, job.entry.name);
      job.entry.percent = percent;
      job.entry.statusKey = statusKey;
      renderResults();
    })
      .then(function (output) {
        var id = "d" + ++downloadSeq;
        downloads[id] = { blob: output.blob, filename: output.filename };
        job.entry.statusKey = "statusDone";
        job.entry.percent = 100;
        job.entry.downloadId = id;
        job.entry.noteKey = output.note || null;
        renderResults();
      })
      .catch(function (error) {
        job.entry.errorKey = (error && error.i18nKey) || "errParse";
        job.entry.errorVars = {};
        renderResults();
      })
      .then(function () {
        isProcessing = false;
        processQueue();
      });
  }

  /* ---------------------------------------------------------------------- */
  /* Event wiring                                                            */
  /* ---------------------------------------------------------------------- */

  function bindEvents() {
    dom.themeToggle.addEventListener("click", toggleTheme);

    dom.langButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setLanguage(button.dataset.lang);
      });
    });

    dom.tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activateTab(tab.dataset.tab);
      });
      tab.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        var index = dom.tabs.indexOf(tab);
        var next =
          event.key === "ArrowRight"
            ? (index + 1) % dom.tabs.length
            : (index - 1 + dom.tabs.length) % dom.tabs.length;
        dom.tabs[next].focus();
        activateTab(dom.tabs[next].dataset.tab);
      });
    });

    dom.sourceText.addEventListener("input", function () {
      scheduleSync("source");
    });
    dom.targetText.addEventListener("input", function () {
      scheduleSync("target");
    });

    dom.sourceScript.addEventListener("change", handleScriptChange);
    dom.targetScript.addEventListener("change", handleScriptChange);
    dom.swapBtn.addEventListener("click", swapScriptsAndText);

    document.querySelectorAll(".pane").forEach(function (pane) {
      pane.querySelectorAll("[data-action]").forEach(function (button) {
        button.addEventListener("click", function () {
          handlePaneAction(pane.dataset.pane, button.dataset.action);
        });
      });
    });

    /* --- Dropzone --- */
    dom.dropzone.addEventListener("click", function () {
      dom.fileInput.click();
    });
    dom.dropzone.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        dom.fileInput.click();
      }
    });

    ["dragenter", "dragover"].forEach(function (type) {
      dom.dropzone.addEventListener(type, function (event) {
        event.preventDefault();
        dom.dropzone.classList.add("is-dragover");
      });
    });
    ["dragleave", "dragend", "drop"].forEach(function (type) {
      dom.dropzone.addEventListener(type, function (event) {
        event.preventDefault();
        dom.dropzone.classList.remove("is-dragover");
      });
    });
    dom.dropzone.addEventListener("drop", function (event) {
      var transfer = event.dataTransfer;
      if (transfer && transfer.files && transfer.files.length)
        addFiles(transfer.files);
    });

    dom.fileInput.addEventListener("change", function () {
      addFiles(dom.fileInput.files);
      dom.fileInput.value = "";
    });

    /* Keep the browser from navigating away when a file misses the dropzone. */
    window.addEventListener("dragover", function (event) {
      if (
        event.dataTransfer &&
        Array.prototype.indexOf.call(
          event.dataTransfer.types || [],
          "Files",
        ) !== -1
      ) {
        event.preventDefault();
      }
    });
    window.addEventListener("drop", function (event) {
      if (
        event.dataTransfer &&
        Array.prototype.indexOf.call(
          event.dataTransfer.types || [],
          "Files",
        ) !== -1
      ) {
        event.preventDefault();
      }
    });

    /* Re-render labels whose text is composed at runtime. */
    document.addEventListener("i18n:changed", function () {
      renderResults();
      updateProgressLabel();
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Boot                                                                    */
  /* ---------------------------------------------------------------------- */

  function init() {
    initTheme();
    initLanguage();
    bindEvents();

    updateSameScriptNotice();
    updateStats("source");
    updateStats("target");
    renderResults();
    showProgress(false);

    /* Seed a friendly first-run preview without overwriting saved work. */
    if (!dom.sourceText.value) {
      dom.sourceText.value = I18N.EXAMPLES[dom.sourceScript.value] || "";
      syncPanes("source");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
