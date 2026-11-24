/* ============================================================================
 * i18n.js
 * ----------------------------------------------------------------------------
 * Ultra yengil interfeys lokalizatsiyasi (UI localisation) — UZ / EN / RU.
 *
 * Usage:
 *   I18N.t('btnCopy')                       -> translated string
 *   I18N.t('errFileSize', { max: '20 MB' }) -> interpolated string
 *   I18N.setLang('en')                      -> switches language + re-renders
 *   I18N.applyTranslations(document)        -> updates the whole DOM
 *
 * Markup hooks:
 *   data-i18n="key"                 -> textContent
 *   data-i18n-html="key"            -> innerHTML
 *   data-i18n-placeholder="key"     -> placeholder attribute
 *   data-i18n-title="key"           -> title attribute
 *   data-i18n-aria-label="key"      -> aria-label attribute
 * ==========================================================================*/
(function (global) {
  "use strict";

  var STORAGE_KEY = "uztr.lang";
  var DEFAULT_LANG = "uz";
  var SUPPORTED = ["uz", "en", "ru"];

  var STRINGS = {
    /* ------------------------------------------------------------------ UZ */
    uz: {
      langName: "Oʻzbekcha",
      skipToContent: "Asosiy qismga oʻtish",
      appTitle: "Oʻzbek Transliterator",
      appSubtitle:
        "Kirill ⇄ Lotin ⇄ Yangi lotin — uch alifbo oʻrtasida tezkor konvertatsiya",

      tabText: "Matn",
      tabDocument: "Hujjat",
      tabTextHint: "Matnni real vaqtda alifbodan alifboga oʻtkazish",
      tabDocumentHint:
        "TXT, CSV, PDF, XLSX va DOCX fayllarni konvertatsiya qilish",

      scriptCyrl: "Кирилл",
      scriptLat: "Lotin (1995)",
      scriptNew: "Yangi lotin (2021)",
      scriptCyrlFull: "Ўзбек кирилл алифбоси",
      scriptLatFull: "1995-yilgi amaldagi lotin alifbosi",
      scriptNewFull: "2021/2023-yilgi isloh qilingan lotin alifbosi",

      sourceLabel: "Manba alifbosi",
      targetLabel: "Natija alifbosi",
      sourcePaneLabel: "Manba matni",
      targetPaneLabel: "Natija matni",

      charsLabel: "belgi",
      wordsLabel: "soʻz",
      linesLabel: "qator",

      btnSwap: "Almashirish",
      btnSwapTitle: "Alifbolarni va matnni almashtirish (⇄)",
      btnCopy: "Nusxalash",
      btnClear: "Tozalash",
      btnPaste: "Qoʻyish",
      btnConvert: "Konvertatsiya qilish",
      btnDownload: "Yuklab olish",
      btnExample: "Namuna",
      btnExampleTitle: "Namuna matnni qoʻyish",

      phSource: "Bu yerga matn yozing yoki qoʻying…",
      phTarget: "Natija shu yerda avtomatik paydo boʻladi…",

      dropTitle: "Faylni shu maydonga tashlang",
      dropOr: "yoki",
      dropBrowse: "Faylni tanlash",
      dropFormats:
        "Qoʻllab-quvvatlanadi: TXT, CSV, PDF, XLSX, DOCX — har bir fayl 20 MB gacha",
      dropActive: "Faylni qoʻyib yuboring…",

      resultsTitle: "Natijalar",
      resultsEmpty: "Hozircha fayl yuklanmagan.",

      statusQueued: "Navbatda",
      statusReading: "Oʻqilmoqda…",
      statusConverting: "Konvertatsiya qilinmoqda…",
      statusGenerating: "Fayl tayyorlanmoqda…",
      statusDone: "Tayyor",
      statusError: "Xatolik",

      docNote:
        "Barcha fayllar faqat sizning brauzeringizda qayta ishlanadi — hech qanday maʼlumot serverga yuborilmaydi.",
      sameScriptNote:
        "Manba va natija alifbolari bir xil — matn faqat normallashtiriladi.",
      pdfFallbackNote:
        "PDF tuzilishi toʻliq saqlanmaydi — natija DOCX sifatida beriladi.",

      errFileType:
        "Qoʻllab-quvvatlanmaydigan format. Ruxsat etilgan: TXT, CSV, PDF, XLSX, DOCX.",
      errFileSize: "Fayl hajmi juda katta. Maksimal ruxsat: {max}.",
      errEmptyFile: "Fayl boʻsh yoki oʻqib boʻlmadi.",
      errParse: "Faylni oʻqishda xatolik yuz berdi.",
      errNoText: "Avval konvertatsiya qilinadigan matnni kiriting.",
      errLibrary:
        "Kerakli kutubxona yuklanmadi. Internet aloqasini tekshiring.",
      errPdfNoText: "PDF fayldan matn topilmadi (ehtimol skanerlangan sahifa).",

      toastCopied: "Nusxalandi",
      toastCleared: "Tozalandi",
      toastPasted: "Qoʻyildi",
      toastSwapped: "Almashtirildi",
      toastCopyError: "Nusxalashning imkoni boʻlmadi.",
      toastPasteError: "Buferdan oʻqib boʻlmadi — Ctrl+V dan foydalaning.",
      toastDownloaded: "«{name}» yuklab olindi",

      themeToggle: "Mavzuni almashtirish",
      themeLight: "Yorugʻ",
      themeDark: "Qorongʻi",
      langToggle: "Interfeys tili",

      ariaSwap: "Manba va natija alifbolarini hamda matnni almashtirish",
      ariaCopy: "Natijani vaqtinchalik xotiraga nusxalash",
      ariaClear: "Matnni tozalash",
      ariaPaste: "Vaqtinchalik xotiradan matn qoʻyish",
      ariaDropzone: "Fayl yuklash maydoni",
      ariaProgress: "Konvertatsiya jarayoni",
      ariaTheme: "Yorugʻ va qorongʻi mavzu oʻrtasida almashish",
      ariaLang: "Interfeys tilini tanlash",

      footerNote:
        "100% brauzerda ishlaydi. Fayllar va matn hech qaerga yuborilmaydi. Statik hosting uchun tayyor.",

      exampleText:
        "Ona tilim — oʻzbek tili. Yangi Oʻzbekiston yoshlari ilm-fan va texnologiyada ulkan yutuqlarga erishmoqda.",
    },

    /* ------------------------------------------------------------------ EN */
    en: {
      langName: "English",
      skipToContent: "Skip to content",
      appTitle: "Uzbek Transliterator",
      appSubtitle:
        "Cyrillic ⇄ Latin ⇄ New Latin — instant conversion between three scripts",

      tabText: "Text",
      tabDocument: "Document",
      tabTextHint: "Convert text between scripts in real time",
      tabDocumentHint: "Convert TXT, CSV, PDF, XLSX and DOCX files",

      scriptCyrl: "Cyrillic",
      scriptLat: "Latin (1995)",
      scriptNew: "New Latin (2021)",
      scriptCyrlFull: "Uzbek Cyrillic alphabet",
      scriptLatFull: "Official Latin alphabet of 1995",
      scriptNewFull: "Reformed Latin alphabet (2021/2023)",

      sourceLabel: "Source script",
      targetLabel: "Target script",
      sourcePaneLabel: "Source text",
      targetPaneLabel: "Result text",

      charsLabel: "characters",
      wordsLabel: "words",
      linesLabel: "lines",

      btnSwap: "Swap",
      btnSwapTitle: "Swap scripts and text (⇄)",
      btnCopy: "Copy",
      btnClear: "Clear",
      btnPaste: "Paste",
      btnConvert: "Convert",
      btnDownload: "Download",
      btnExample: "Example",
      btnExampleTitle: "Insert a sample text",

      phSource: "Type or paste your text here…",
      phTarget: "The result appears here automatically…",

      dropTitle: "Drag & drop your file here",
      dropOr: "or",
      dropBrowse: "Browse files",
      dropFormats:
        "Supported: TXT, CSV, PDF, XLSX, DOCX — up to 20 MB per file",
      dropActive: "Release to upload…",

      resultsTitle: "Results",
      resultsEmpty: "No files processed yet.",

      statusQueued: "Queued",
      statusReading: "Reading…",
      statusConverting: "Converting…",
      statusGenerating: "Generating file…",
      statusDone: "Done",
      statusError: "Error",

      docNote:
        "Every file is processed entirely inside your browser — nothing is ever uploaded to a server.",
      sameScriptNote:
        "Source and target scripts are identical — the text is only normalised.",
      pdfFallbackNote:
        "PDF layout cannot be fully preserved — the result is provided as DOCX.",

      errFileType: "Unsupported format. Allowed: TXT, CSV, PDF, XLSX, DOCX.",
      errFileSize: "File is too large. Maximum allowed: {max}.",
      errEmptyFile: "The file is empty or could not be read.",
      errParse: "Something went wrong while parsing the file.",
      errNoText: "Please enter some text to convert first.",
      errLibrary:
        "A required library failed to load. Please check your connection.",
      errPdfNoText:
        "No text could be extracted from the PDF (it may be a scanned document).",

      toastCopied: "Copied",
      toastCleared: "Cleared",
      toastPasted: "Pasted",
      toastSwapped: "Swapped",
      toastCopyError: "Copy failed.",
      toastPasteError: "Could not read the clipboard — please use Ctrl+V.",
      toastDownloaded: "“{name}” downloaded",

      themeToggle: "Toggle theme",
      themeLight: "Light",
      themeDark: "Dark",
      langToggle: "Interface language",

      ariaSwap: "Swap the source and target scripts and texts",
      ariaCopy: "Copy the result to the clipboard",
      ariaClear: "Clear the text",
      ariaPaste: "Paste text from the clipboard",
      ariaDropzone: "File upload area",
      ariaProgress: "Conversion progress",
      ariaTheme: "Switch between light and dark theme",
      ariaLang: "Choose the interface language",

      footerNote:
        "Runs 100% in the browser. Your text and files never leave your device. Ready for static hosting.",

      exampleText:
        "My mother tongue is Uzbek. The youth of the New Uzbekistan are achieving remarkable results in science and technology.",
    },

    /* ------------------------------------------------------------------ RU */
    ru: {
      langName: "Русский",
      skipToContent: "Перейти к содержимому",
      appTitle: "Узбекский транслитератор",
      appSubtitle:
        "Кириллица ⇄ Латиница ⇄ Новая латиница — мгновенная конвертация трёх алфавитов",

      tabText: "Текст",
      tabDocument: "Документ",
      tabTextHint: "Перевод текста между алфавитами в реальном времени",
      tabDocumentHint: "Конвертация файлов TXT, CSV, PDF, XLSX и DOCX",

      scriptCyrl: "Кириллица",
      scriptLat: "Латиница (1995)",
      scriptNew: "Новая латиница (2021)",
      scriptCyrlFull: "Узбекская кириллица",
      scriptLatFull: "Официальная латиница 1995 года",
      scriptNewFull: "Реформированная латиница (2021/2023)",

      sourceLabel: "Исходный алфавит",
      targetLabel: "Целевой алфавит",
      sourcePaneLabel: "Исходный текст",
      targetPaneLabel: "Результат",

      charsLabel: "символов",
      wordsLabel: "слов",
      linesLabel: "строк",

      btnSwap: "Поменять",
      btnSwapTitle: "Поменять алфавиты и текст местами (⇄)",
      btnCopy: "Копировать",
      btnClear: "Очистить",
      btnPaste: "Вставить",
      btnConvert: "Конвертировать",
      btnDownload: "Скачать",
      btnExample: "Пример",
      btnExampleTitle: "Вставить пример текста",

      phSource: "Введите или вставьте текст…",
      phTarget: "Результат появится здесь автоматически…",

      dropTitle: "Перетащите файл сюда",
      dropOr: "или",
      dropBrowse: "Выбрать файл",
      dropFormats:
        "Поддерживается: TXT, CSV, PDF, XLSX, DOCX — до 20 МБ на файл",
      dropActive: "Отпустите, чтобы загрузить…",

      resultsTitle: "Результаты",
      resultsEmpty: "Файлы пока не обработаны.",

      statusQueued: "В очереди",
      statusReading: "Чтение…",
      statusConverting: "Конвертация…",
      statusGenerating: "Формирование файла…",
      statusDone: "Готово",
      statusError: "Ошибка",

      docNote:
        "Все файлы обрабатываются прямо в браузере — данные никуда не отправляются.",
      sameScriptNote:
        "Исходный и целевой алфавиты совпадают — текст только нормализуется.",
      pdfFallbackNote:
        "Разметка PDF не сохраняется полностью — результат выдаётся в формате DOCX.",

      errFileType:
        "Неподдерживаемый формат. Доступно: TXT, CSV, PDF, XLSX, DOCX.",
      errFileSize: "Файл слишком большой. Максимум: {max}.",
      errEmptyFile: "Файл пуст или не читается.",
      errParse: "Не удалось обработать файл.",
      errNoText: "Сначала введите текст для конвертации.",
      errLibrary:
        "Не удалось загрузить библиотеку. Проверьте подключение к интернету.",
      errPdfNoText: "В PDF не найден текст (возможно, это скан).",

      toastCopied: "Скопировано",
      toastCleared: "Очищено",
      toastPasted: "Вставлено",
      toastSwapped: "Заменено",
      toastCopyError: "Не удалось скопировать.",
      toastPasteError: "Не удалось прочитать буфер — используйте Ctrl+V.",
      toastDownloaded: "«{name}» загружен",

      themeToggle: "Сменить тему",
      themeLight: "Светлая",
      themeDark: "Тёмная",
      langToggle: "Язык интерфейса",

      ariaSwap: "Поменять исходный и целевой алфавиты вместе с текстом",
      ariaCopy: "Скопировать результат в буфер обмена",
      ariaClear: "Очистить текст",
      ariaPaste: "Вставить текст из буфера обмена",
      ariaDropzone: "Область загрузки файлов",
      ariaProgress: "Ход конвертации",
      ariaTheme: "Переключить светлую и тёмную тему",
      ariaLang: "Выбор языка интерфейса",

      footerNote:
        "Работает полностью в браузере. Ваши тексты и файлы никуда не отправляются. Готово к статическому хостингу.",

      exampleText:
        "Мой родной язык — узбекский. Молодёжь Нового Узбекистана добивается больших успехов в науке и технологиях.",
    },
  };

  /* Sample texts inserted by the “Example” button — one per script. */
  var EXAMPLES = {
    cyrl: "Ona tilim — ўзбек тили. Янги Ўзбекистон ёшлари илм-фан ва технологияларда улкан ютуқларга эришмоқда. Бугун 2024-yil 12-sentyabr kuni Тошкент шаҳрида халқаро анжуман бўлиб ўтди.",
    lat: "Ona tilim — oʻzbek tili. Yangi Oʻzbekiston yoshlari ilm-fan va texnologiyalarda ulkan yutuqlarga erishmoqda. Bugun 2024-yil 12-sentyabr kuni Toshkent shahrida xalqaro anjuman boʻlib oʻtdi.",
    new: "Ona tilim — ōzbek tili. Yañi Ōzbekiston yoshlari ilm-fan va texnologiyalarda ulkan yutuqlarga erishmoqda. Bugun 2024-yil 12-sentyabr kuni Toshkent şahrida xalqaro anjuman bōlib ōtdi.",
  };

  var currentLang = DEFAULT_LANG;

  /* ------------------------------------------------------------------ API */

  function normalizeLang(lang) {
    return SUPPORTED.indexOf(lang) !== -1 ? lang : DEFAULT_LANG;
  }

  function getLang() {
    return currentLang;
  }

  /**
   * Translate a key, optionally interpolating {placeholders}.
   * @param {string} key
   * @param {Object} [vars]
   * @returns {string}
   */
  function t(key, vars) {
    var table = STRINGS[currentLang] || STRINGS[DEFAULT_LANG];
    var value = table[key];
    if (value === undefined) value = STRINGS[DEFAULT_LANG][key];
    if (value === undefined) return key;
    if (vars) {
      value = value.replace(/\{(\w+)\}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(vars, name)
          ? String(vars[name])
          : match;
      });
    }
    return value;
  }

  /**
   * Update every element carrying a data-i18n* attribute inside `root`.
   * @param {ParentNode} [root]
   */
  function applyTranslations(root) {
    root = root || document;

    root.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute(
        "placeholder",
        t(el.getAttribute("data-i18n-placeholder")),
      );
    });
    root.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    root.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
    });
  }

  /**
   * Change the interface language and re-render the DOM.
   * @param {string} lang 'uz' | 'en' | 'ru'
   */
  function setLang(lang) {
    currentLang = normalizeLang(lang);
    try {
      localStorage.setItem(STORAGE_KEY, currentLang);
    } catch (e) {
      /* storage disabled — ignore */
    }
    document.documentElement.setAttribute("lang", currentLang);
    applyTranslations(document);
    document.dispatchEvent(
      new CustomEvent("i18n:changed", { detail: { lang: currentLang } }),
    );
  }

  /** Restore the previously stored language (if any). */
  function initLang() {
    var stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      stored = null;
    }
    if (!stored) {
      var nav = (navigator.language || "uz").slice(0, 2).toLowerCase();
      stored = SUPPORTED.indexOf(nav) !== -1 ? nav : DEFAULT_LANG;
    }
    currentLang = normalizeLang(stored);
    document.documentElement.setAttribute("lang", currentLang);
    return currentLang;
  }

  global.I18N = {
    SUPPORTED: SUPPORTED,
    EXAMPLES: EXAMPLES,
    t: t,
    getLang: getLang,
    setLang: setLang,
    initLang: initLang,
    applyTranslations: applyTranslations,
  };
})(window);
