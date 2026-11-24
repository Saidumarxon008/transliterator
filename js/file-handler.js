/* ============================================================================
 * file-handler.js
 * ----------------------------------------------------------------------------
 * Mijoz tomonidagi hujjat konvertatsiyasi (100% client-side file pipeline).
 *
 *  TXT   -> text/plain
 *  CSV   -> PapaParse  (har bir katak saqlanadi)
 *  XLSX  -> SheetJS    (faqat matn kataklari, formulalar/raqamlar tegilmaydi)
 *  DOCX  -> mammoth.js (HTML -> bloklar) + JSZip (yangi DOCX yoziladi)
 *  PDF   -> pdf.js     (matn ajratiladi)  -> DOCX (yoki TXT) natija
 *
 * Hech qanday ma'lumot tarmoqqa yuborilmaydi.
 * ==========================================================================*/
(function (global) {
  "use strict";

  var MAX_FILE_SIZE = 20 * 1024 * 1024; /* 20 MB */
  var SUPPORTED_EXTENSIONS = [
    "txt",
    "csv",
    "tsv",
    "pdf",
    "xlsx",
    "xls",
    "docx",
  ];

  var MIME = {
    txt: "text/plain;charset=utf-8",
    csv: "text/csv;charset=utf-8",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  /* ---------------------------------------------------------------------- */
  /* Small helpers                                                          */
  /* ---------------------------------------------------------------------- */

  function getExtension(filename) {
    var parts = String(filename || "").split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }

  function getBaseName(filename) {
    return String(filename || "file").replace(/\.[^.]+$/, "") || "file";
  }

  /**
   * Validate a file before processing.
   * @returns {{ok:boolean, errorKey?:string, vars?:Object}}
   */
  function validate(file) {
    var ext = getExtension(file.name);
    if (SUPPORTED_EXTENSIONS.indexOf(ext) === -1) {
      return { ok: false, errorKey: "errFileType" };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { ok: false, errorKey: "errFileSize", vars: { max: "20 MB" } };
    }
    if (file.size === 0) {
      return { ok: false, errorKey: "errEmptyFile" };
    }
    return { ok: true };
  }

  function readAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result));
      };
      reader.onerror = function () {
        reject(new Error("read-error"));
      };
      reader.readAsText(file, "utf-8");
    });
  }

  function readAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error("read-error"));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ====================================================================== */
  /* PLAIN TEXT                                                             */
  /* ====================================================================== */

  function convertText(text, translit, withBom) {
    var output = translit(text);
    if (withBom) output = "\uFEFF" + output;
    return new Blob([output], { type: MIME.txt });
  }

  /* ====================================================================== */
  /* CSV / TSV                                                              */
  /* ====================================================================== */

  function convertCsv(text, translit, ext) {
    var delimiter = ext === "tsv" ? "\t" : "";

    if (!global.Papa) {
      /* Graceful fallback: line based conversion (structure preserved). */
      var lines = text.split(/\r\n|\n|\r/).map(translit);
      return new Blob(["\uFEFF" + lines.join("\r\n")], { type: MIME.csv });
    }

    var parsed = global.Papa.parse(text, {
      delimiter: delimiter,
      skipEmptyLines: false,
      dynamicTyping: false,
    });

    var rows = parsed.data.map(function (row) {
      return row.map(function (cell) {
        return cell === null || cell === undefined
          ? cell
          : translit(String(cell));
      });
    });

    var out = global.Papa.unparse(rows, {
      delimiter:
        parsed.meta && parsed.meta.delimiter ? parsed.meta.delimiter : ",",
      quotes: false,
      newline: "\r\n",
    });

    return new Blob(["\uFEFF" + out], { type: MIME.csv });
  }

  /* ====================================================================== */
  /* XLSX / XLS                                                             */
  /* ====================================================================== */

  function convertWorkbook(arrayBuffer, translit, onProgress) {
    if (!global.XLSX) throw new Error("library-missing");

    var workbook = global.XLSX.read(arrayBuffer, { type: "array" });
    var sheetNames = workbook.SheetNames;

    sheetNames.forEach(function (name, index) {
      var sheet = workbook.Sheets[name];
      if (!sheet || !sheet["!ref"]) return;

      var range = global.XLSX.utils.decode_range(sheet["!ref"]);
      for (var r = range.s.r; r <= range.e.r; r++) {
        for (var c = range.s.c; c <= range.e.c; c++) {
          var cell = sheet[global.XLSX.utils.encode_cell({ r: r, c: c })];
          if (!cell) continue;
          /* Only translate textual values; formulas, numbers, dates stay. */
          if (
            (cell.t === "s" || cell.t === "str") &&
            typeof cell.v === "string"
          ) {
            cell.v = translit(cell.v);
            if (cell.w) delete cell.w;
            if (cell.h) delete cell.h;
          }
        }
      }
      onProgress(10 + Math.round(((index + 1) / sheetNames.length) * 60));
    });

    var outBook = global.XLSX.utils.book_new();
    sheetNames.forEach(function (name) {
      global.XLSX.utils.book_append_sheet(outBook, workbook.Sheets[name], name);
    });

    var buffer = global.XLSX.write(outBook, {
      bookType: "xlsx",
      type: "array",
    });
    return new Blob([buffer], { type: MIME.xlsx });
  }

  /* ====================================================================== */
  /* Minimal, dependency-free DOCX writer (JSZip based)                     */
  /* ====================================================================== */

  var DOCX_NS =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

  function escapeXml(text) {
    return String(text)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function runXml(run) {
    if (run.br) return "<w:r><w:br/></w:r>";

    var props = "";
    if (run.bold) props += "<w:b/>";
    if (run.italic) props += "<w:i/>";
    if (run.underline) props += '<w:u w:val="single"/>';
    if (run.vertAlign) props += '<w:vertAlign w:val="' + run.vertAlign + '"/>';
    if (run.mono)
      props +=
        '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>';

    var text = escapeXml(run.text || "");
    var rPr = props ? "<w:rPr>" + props + "</w:rPr>" : "";
    return "<w:r>" + rPr + '<w:t xml:space="preserve">' + text + "</w:t></w:r>";
  }

  function paragraphXml(runs, options) {
    options = options || {};
    var pPr = "";

    if (options.style) pPr += '<w:pStyle w:val="' + options.style + '"/>';
    if (options.list === "ul")
      pPr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    if (options.list === "ol")
      pPr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>';
    if (options.indent) pPr += '<w:ind w:left="720"/>';
    if (options.align) pPr += '<w:jc w:val="' + options.align + '"/>';

    var body =
      runs && runs.length
        ? runs.map(runXml).join("")
        : '<w:r><w:t xml:space="preserve"></w:t></w:r>';
    return (
      "<w:p>" + (pPr ? "<w:pPr>" + pPr + "</w:pPr>" : "") + body + "</w:p>"
    );
  }

  function tableXml(rows) {
    var columnCount = rows.reduce(function (max, row) {
      return Math.max(max, row.length);
    }, 1);
    var width = Math.floor(9360 / columnCount);

    var grid = "";
    for (var g = 0; g < columnCount; g++)
      grid += '<w:gridCol w:w="' + width + '"/>';

    var borders =
      "<w:tblBorders>" +
      ["top", "left", "bottom", "right", "insideH", "insideV"]
        .map(function (side) {
          return (
            "<w:" +
            side +
            ' w:val="single" w:sz="4" w:space="0" w:color="B0B0B0"/>'
          );
        })
        .join("") +
      "</w:tblBorders>";

    var body = rows
      .map(function (row) {
        var cells = "";
        for (var c = 0; c < columnCount; c++) {
          var blocks = row[c] || [{ type: "paragraph", runs: [{ text: "" }] }];
          var content = blocks
            .map(function (block) {
              return paragraphXml(block.runs, block.options);
            })
            .join("");
          cells +=
            '<w:tc><w:tcPr><w:tcW w:w="' +
            width +
            '" w:type="dxa"/></w:tcPr>' +
            content +
            "</w:tc>";
        }
        return "<w:tr>" + cells + "</w:tr>";
      })
      .join("");

    return (
      '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>' +
      borders +
      "</w:tblPr>" +
      "<w:tblGrid>" +
      grid +
      "</w:tblGrid>" +
      body +
      "</w:tbl>"
    );
  }

  function blockXml(block) {
    if (block.type === "table") return tableXml(block.rows);
    return paragraphXml(block.runs, block.options);
  }

  function buildDocxBlob(blocks) {
    if (!global.JSZip) return Promise.reject(new Error("library-missing"));

    var body = blocks.map(blockXml).join("");
    var documentXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      "<w:document " +
      DOCX_NS +
      "><w:body>" +
      body +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
      "</w:body></w:document>";

    var headingStyles = [1, 2, 3, 4, 5, 6]
      .map(function (level) {
        var sizes = [32, 28, 26, 24, 22, 22];
        return (
          '<w:style w:type="paragraph" w:styleId="Heading' +
          level +
          '">' +
          '<w:name w:val="heading ' +
          level +
          '"/><w:basedOn w:val="Normal"/>' +
          '<w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="' +
          (level - 1) +
          '"/>' +
          '<w:spacing w:before="240" w:after="120"/></w:pPr>' +
          '<w:rPr><w:b/><w:sz w:val="' +
          sizes[level - 1] +
          '"/></w:rPr></w:style>'
        );
      })
      .join("");

    var stylesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      "<w:styles " +
      DOCX_NS +
      "><w:docDefaults><w:rPrDefault><w:rPr>" +
      '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/>' +
      "</w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>" +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
      '<w:name w:val="Normal"/></w:style>' +
      headingStyles +
      "</w:styles>";

    var numberingXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      "<w:numbering " +
      DOCX_NS +
      ">" +
      '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/>' +
      '<w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/>' +
      '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
      '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/>' +
      '<w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/>' +
      '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
      '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>';

    var contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      "</Types>";

    var rootRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>";

    var docRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
      "</Relationships>";

    var zip = new global.JSZip();
    zip.file("[Content_Types].xml", contentTypes);
    zip.folder("_rels").file(".rels", rootRels);
    var word = zip.folder("word");
    word.file("document.xml", documentXml);
    word.file("styles.xml", stylesXml);
    word.file("numbering.xml", numberingXml);
    word.folder("_rels").file("document.xml.rels", docRels);

    return zip.generateAsync({
      type: "blob",
      mimeType: MIME.docx,
      compression: "DEFLATE",
    });
  }

  /* ====================================================================== */
  /* DOCX reading: mammoth HTML -> layout blocks                            */
  /* ====================================================================== */

  var HEADING_TAGS = {
    h1: "Heading1",
    h2: "Heading2",
    h3: "Heading3",
    h4: "Heading4",
    h5: "Heading5",
    h6: "Heading6",
  };
  var INLINE_WRAPPERS = {
    strong: "bold",
    b: "bold",
    em: "italic",
    i: "italic",
    u: "underline",
    a: "underline",
    code: "mono",
    tt: "mono",
    kbd: "mono",
    samp: "mono",
    sup: "super",
    sub: "sub",
  };

  function collectRuns(element, translit, inherited) {
    var attrs = {
      bold: !!inherited.bold,
      italic: !!inherited.italic,
      underline: !!inherited.underline,
      mono: !!inherited.mono,
      vertAlign: inherited.vertAlign || null,
    };
    var runs = [];
    var nodes = element.childNodes;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.nodeType === 3) {
        var text = translit(node.nodeValue);
        if (text.length) {
          runs.push({
            text: text,
            bold: attrs.bold,
            italic: attrs.italic,
            underline: attrs.underline,
            mono: attrs.mono,
            vertAlign: attrs.vertAlign,
          });
        }
      } else if (node.nodeType === 1) {
        var tag = node.tagName.toLowerCase();
        if (tag === "br") {
          runs.push({ br: true });
          continue;
        }
        var next = {
          bold: attrs.bold,
          italic: attrs.italic,
          underline: attrs.underline,
          mono: attrs.mono,
          vertAlign: attrs.vertAlign,
        };
        var flag = INLINE_WRAPPERS[tag];
        if (flag === "bold") next.bold = true;
        else if (flag === "italic") next.italic = true;
        else if (flag === "underline") next.underline = true;
        else if (flag === "mono") next.mono = true;
        else if (flag === "super") next.vertAlign = "superscript";
        else if (flag === "sub") next.vertAlign = "subscript";
        runs = runs.concat(collectRuns(node, translit, next));
      }
    }
    return runs;
  }

  function listItemsOf(listElement, translit, ordered, out) {
    Array.prototype.forEach.call(listElement.children, function (child) {
      if (child.tagName.toLowerCase() !== "li") return;
      var runs = [];
      /* Only the direct inline content of <li> becomes the item paragraph. */
      Array.prototype.forEach.call(child.childNodes, function (node) {
        if (
          node.nodeType === 3 ||
          (node.nodeType === 1 &&
            !["ul", "ol"].includes(node.tagName.toLowerCase()))
        ) {
          var wrapper = document.createElement("span");
          wrapper.appendChild(node.cloneNode(true));
          wrapper.childNodes.forEach(function (inner) {
            if (inner.nodeType === 3) {
              var text = translit(inner.nodeValue);
              if (text.length) runs.push({ text: text });
            } else {
              runs = runs.concat(collectRuns(inner, translit, {}));
            }
          });
        }
      });
      out.push({
        type: "paragraph",
        runs: runs,
        options: { list: ordered ? "ol" : "ul" },
      });

      /* Nested lists keep their own paragraphs. */
      Array.prototype.forEach.call(child.children, function (nested) {
        var tag = nested.tagName.toLowerCase();
        if (tag === "ul" || tag === "ol")
          listItemsOf(nested, translit, tag === "ol", out);
      });
    });
    return out;
  }

  function collectBlocks(container, translit, out) {
    Array.prototype.forEach.call(container.children, function (child) {
      var tag = child.tagName.toLowerCase();

      if (tag === "p" || tag === "pre" || tag === "blockquote") {
        var runs = collectRuns(child, translit, {});
        out.push({
          type: "paragraph",
          runs: runs,
          options: tag === "blockquote" ? { indent: true } : {},
        });
        return;
      }

      if (HEADING_TAGS[tag]) {
        out.push({
          type: "paragraph",
          runs: collectRuns(child, translit, {}),
          options: { style: HEADING_TAGS[tag] },
        });
        return;
      }

      if (tag === "ul" || tag === "ol") {
        listItemsOf(child, translit, tag === "ol", out);
        return;
      }

      if (tag === "table") {
        var rows = [];
        Array.prototype.forEach.call(child.rows, function (row) {
          var cells = [];
          Array.prototype.forEach.call(row.cells, function (cell) {
            var cellBlocks = [];
            collectBlocks(cell, translit, cellBlocks);
            if (!cellBlocks.length)
              cellBlocks.push({
                type: "paragraph",
                runs: [{ text: cell.textContent.trim() }],
              });
            cells.push(cellBlocks);
          });
          rows.push(cells);
        });
        out.push({ type: "table", rows: rows });
        return;
      }

      if (tag === "hr") {
        out.push({ type: "paragraph", runs: [{ text: "" }] });
        return;
      }

      /* Generic containers (div, section, article, body…) are flattened. */
      if (child.children.length || child.textContent.trim().length) {
        var before = out.length;
        collectBlocks(child, translit, out);
        if (out.length === before && child.textContent.trim().length) {
          out.push({
            type: "paragraph",
            runs: [{ text: translit(child.textContent) }],
          });
        }
      }
    });
    return out;
  }

  function convertDocx(arrayBuffer, translit) {
    if (!global.mammoth) return Promise.reject(new Error("library-missing"));

    return global.mammoth
      .convertToHtml({ arrayBuffer: arrayBuffer })
      .then(function (result) {
        var parsed = new DOMParser().parseFromString(
          result.value || "",
          "text/html",
        );
        var blocks = collectBlocks(parsed.body, translit, []);
        if (!blocks.length) throw new Error("empty-document");
        return buildDocxBlob(blocks);
      });
  }

  /* ====================================================================== */
  /* PDF reading: pdf.js -> text lines -> DOCX                              */
  /* ====================================================================== */

  function groupPdfItemsIntoLines(items) {
    var buckets = [];

    items.forEach(function (item) {
      if (!item.str || !item.str.length) return;
      var y = item.transform[5];
      var bucket = null;
      for (var i = 0; i < buckets.length; i++) {
        if (Math.abs(buckets[i].y - y) <= 2.5) {
          bucket = buckets[i];
          break;
        }
      }
      if (!bucket) {
        bucket = { y: y, items: [] };
        buckets.push(bucket);
      }
      bucket.items.push(item);
    });

    buckets.sort(function (a, b) {
      return b.y - a.y;
    });

    return buckets
      .map(function (bucket) {
        bucket.items.sort(function (a, b) {
          return a.transform[4] - b.transform[4];
        });
        var text = "";
        var cursor = null;
        bucket.items.forEach(function (item) {
          var x = item.transform[4];
          if (cursor !== null && x - cursor > 1.5 && !/\s$/.test(text))
            text += " ";
          text += item.str;
          cursor = x + (typeof item.width === "number" ? item.width : 0);
        });
        return text.replace(/\s+/g, " ").trim();
      })
      .filter(function (line) {
        return line.length > 0;
      });
  }

  function convertPdf(arrayBuffer, translit, onProgress) {
    if (!global.pdfjsLib) return Promise.reject(new Error("library-missing"));

    /* pdf.js needs to know where its worker lives (same CDN as the core). */
    if (
      global.pdfjsLib.GlobalWorkerOptions &&
      !global.pdfjsLib.GlobalWorkerOptions.workerSrc
    ) {
      global.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    return global.pdfjsLib
      .getDocument({ data: new Uint8Array(arrayBuffer) })
      .promise.then(function (pdf) {
        var blocks = [];
        var pages = [];
        for (var p = 1; p <= pdf.numPages; p++) pages.push(p);

        var chain = Promise.resolve();
        pages.forEach(function (pageNumber, index) {
          chain = chain.then(function () {
            return pdf.getPage(pageNumber).then(function (page) {
              return page.getTextContent().then(function (content) {
                groupPdfItemsIntoLines(content.items).forEach(function (line) {
                  blocks.push({
                    type: "paragraph",
                    runs: [{ text: translit(line) }],
                  });
                });
                blocks.push({ type: "paragraph", runs: [{ text: "" }] });
                onProgress(10 + Math.round(((index + 1) / pages.length) * 60));
              });
            });
          });
        });

        return chain.then(function () {
          if (!blocks.length) throw new Error("pdf-no-text");
          return buildDocxBlob(blocks);
        });
      });
  }

  /* ====================================================================== */
  /* Public entry point                                                     */
  /* ====================================================================== */

  /**
   * Convert one uploaded file.
   *
   * @param {File}   file        the uploaded file
   * @param {Function} translit  (text) => transliterated text
   * @param {Function} onProgress (percent, statusKey) => void
   * @returns {Promise<{blob:Blob, filename:string, note?:string}>}
   */
  function convertFile(file, translit, onProgress) {
    var report = onProgress || function () {};
    var ext = getExtension(file.name);
    var base = getBaseName(file.name);

    report(5, "statusReading");

    var targetExt = ext === "tsv" ? "csv" : ext;
    var promise;

    if (ext === "txt") {
      promise = readAsText(file).then(function (text) {
        return {
          blob: convertText(text, translit, false),
          filename: base + ".txt",
        };
      });
    } else if (ext === "csv" || ext === "tsv") {
      promise = readAsText(file).then(function (text) {
        return {
          blob: convertCsv(text, translit, ext),
          filename: base + ".csv",
        };
      });
    } else if (ext === "xlsx" || ext === "xls") {
      promise = readAsArrayBuffer(file).then(function (buffer) {
        report(10, "statusConverting");
        return {
          blob: convertWorkbook(buffer, translit, report),
          filename: base + ".xlsx",
        };
      });
    } else if (ext === "docx") {
      promise = readAsArrayBuffer(file).then(function (buffer) {
        report(15, "statusConverting");
        return convertDocx(buffer, translit).then(function (blob) {
          return { blob: blob, filename: base + ".docx" };
        });
      });
    } else if (ext === "pdf") {
      promise = readAsArrayBuffer(file).then(function (buffer) {
        report(10, "statusConverting");
        return convertPdf(buffer, translit, report).then(function (blob) {
          return {
            blob: blob,
            filename: base + ".docx",
            note: "pdfFallbackNote",
          };
        });
      });
    } else {
      return Promise.reject(new Error("unsupported"));
    }

    /* Fallback for PDFs when the DOCX writer is unavailable. */
    return promise
      .catch(function (error) {
        if (error && error.message === "pdf-no-text") {
          error.i18nKey = "errPdfNoText";
        } else if (error && error.message === "library-missing") {
          error.i18nKey = "errLibrary";
        } else if (error && error.message === "empty-document") {
          error.i18nKey = "errEmptyFile";
        }
        throw error;
      })
      .then(function (result) {
        report(100, "statusDone");
        return result;
      });
  }

  global.UzFileHandler = {
    MAX_FILE_SIZE: MAX_FILE_SIZE,
    SUPPORTED_EXTENSIONS: SUPPORTED_EXTENSIONS,
    getExtension: getExtension,
    getBaseName: getBaseName,
    validate: validate,
    convertFile: convertFile,
    _buildDocxBlob: buildDocxBlob,
  };
})(window);
