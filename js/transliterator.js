/* ============================================================================
 * transliterator.js
 * ----------------------------------------------------------------------------
 * O'zbek ko'p-alifboli transliteratsiya dvigateli (Uzbek multi-script engine).
 *
 * Supported scripts:
 *   'cyrl' -> Кирилл (Ўзбек кирилл алифбоси)
 *   'lat'  -> Standard Latin (1995-yilgi amaldagi lotin alifbosi)
 *   'new'  -> Reformed / New Latin (2021-2023 isloh qilingan: ō, ḡ, ş, ç, ñ)
 *
 * Pipeline:  source script ──► standard Latin (internal) ──► target script
 *
 * The engine is fully self-contained, has no dependencies and runs in the
 * browser (or under Node.js for testing).
 * ==========================================================================*/
(function (global) {
  "use strict";

  /* ---------------------------------------------------------------------- */
  /* 1. Constants                                                           */
  /* ---------------------------------------------------------------------- */

  var SCRIPTS = {
    CYRILLIC: "cyrl",
    LATIN: "lat",
    NEW_LATIN: "new",
  };

  /* Modifier letters used by the official 1995 Latin alphabet. */
  var MOD_TURNED = "\u02BB"; // ʻ  MODIFIER LETTER TURNED COMMA   -> oʻ / gʻ
  var MOD_APOS = "\u02BC"; // ʼ  MODIFIER LETTER APOSTROPHE    -> tutuq belgisi

  /* Every apostrophe-like character the user may paste, mapped to one marker. */
  var APOSTROPHE_RE =
    /[\u0027\u0060\u00B4\u2018\u2019\u201B\u02B9\u02BB\u02BC\u2032\uFF07\u02BC]/g;

  /* Cyrillic vowels (used by the context aware е / ц rules). */
  var CYR_VOWELS = "аеёиоуэюяўы";
  /* Latin vowels (used by the context aware e rule). */
  var LAT_VOWELS = "aeiou";

  /* Word boundaries: Unicode letters + marks.  After apostrophe normalisation
   * the modifier letters (Unicode category Lm) are part of the word, so the
   * whole word "maʼno" is transliterated as one unit. */
  var WORD_RE = /[\p{L}\p{M}]+/gu;

  /* ---------------------------------------------------------------------- */
  /* 2. Letter tables                                                       */
  /* ---------------------------------------------------------------------- */

  /* Cyrillic -> standard Latin (lowercase base table).  Context sensitive
   * letters (е, ё, ю, я, ц) are handled explicitly in cyrToLatin(). */
  var CYR_TO_LAT = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "j",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "x",
    ц: "s",
    ч: "ch",
    ш: "sh",
    щ: "sh",
    ъ: MOD_APOS,
    ы: "i",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
    ў: "o" + MOD_APOS,
    қ: "q",
    ғ: "g" + MOD_APOS,
    ҳ: "h",
  };

  /* Latin -> Cyrillic: multi character sequences (checked first, longest
   * match wins).  All keys are lowercase; casing is re-applied afterwards. */
  var LAT_TO_CYR_DIGRAPHS = [
    ["o" + MOD_APOS, "ў"],
    ["g" + MOD_APOS, "ғ"],
    ["sh", "ш"],
    ["ch", "ч"],
    ["yo", "ё"],
    ["ya", "я"],
    ["yu", "ю"],
    ["ye", "е"],
    ["ts", "ц"],
    ["ng", "нг"],
  ];

  /* Latin -> Cyrillic: single characters. */
  var LAT_TO_CYR_SINGLE = {
    a: "а",
    b: "б",
    c: "к",
    d: "д",
    f: "ф",
    g: "г",
    h: "ҳ",
    i: "и",
    j: "ж",
    k: "к",
    l: "л",
    m: "м",
    n: "н",
    o: "о",
    p: "п",
    q: "қ",
    r: "р",
    s: "с",
    t: "т",
    u: "у",
    v: "в",
    w: "в",
    x: "х",
    y: "й",
    z: "з",
    e: "е",
  };

  /* ---------------------------------------------------------------------- */
  /* 3. User editable exception dictionaries                                */
  /* ---------------------------------------------------------------------- */
  /* Keys are always lowercase.  Values are given in the natural spelling of
   * the target script and are normalised (apostrophes) on load.  Add your own
   * entries here to force a specific spelling for irregular words.          */

  var EXCEPTIONS_CYR_TO_LAT = {
    /* -- Spec examples (rule-consistent, kept for explicit control) ------ */
    сентябр: "sentyabr",
    октябр: "oktyabr",
    бюджет: "byudjet",
    мўжиза: "mo" + MOD_APOS + "jiza",
    /* -- Russian borrowings where ъ / ь must be dropped or vocalised ----- */
    объект: "obyekt",
    объектив: "obyektiv",
    субъект: "subyekt",
    субъектив: "subyektiv",
    съезд: "syezd",
    адъютант: "adyutant",
    инъекция: "inyeksiya",
    конъюнктура: "konyunktura",
    пьеса: "pyesa",
    семья: "semya",
    карьера: "karyera",
    премьера: "premyera",
    компьютер: "kompyuter",
    медальон: "medalyon",
    бульон: "bulyon",
    павильон: "pavilyon",
    пицца: "pitsa",
  };

  var EXCEPTIONS_LAT_TO_CYR = {
    sentyabr: "сентябр",
    oktyabr: "октябр",
    byudjet: "бюджет",
    ["mo" + MOD_APOS + "jiza"]: "мўжиза",
    obyekt: "объект",
    obyektiv: "объектив",
    subyekt: "субъект",
    subyektiv: "субъектив",
    syezd: "съезд",
    adyutant: "адъютант",
    inyeksiya: "инъекция",
    konyunktura: "конъюнктура",
    pyesa: "пьеса",
    semya: "семья",
    karyera: "карьера",
    premyera: "премьера",
    kompyuter: "компьютер",
    medalyon: "медальон",
    bulyon: "бульон",
    pavilyon: "павильон",
    pitsa: "пицца",
    /* -- "ц" words that Uzbek Latin writes with a plain "s" ------------- */
    stansiya: "станция",
    stantsiya: "станция",
    sement: "цемент",
    sirk: "цирк",
    sentr: "центр",
    stsenariy: "сценарий",
  };

  /* ---------------------------------------------------------------------- */
  /* 4. Helpers                                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * Normalise every apostrophe variant to one internal marker.
   * @param {string} text
   * @returns {string}
   */
  function normalizeApostrophes(text) {
    if (typeof text !== "string") return "";
    return text.replace(APOSTROPHE_RE, MOD_APOS);
  }

  /** Normalise the keys/values of an exception dictionary. */
  function normalizeDict(dict) {
    var out = {};
    Object.keys(dict).forEach(function (key) {
      out[normalizeApostrophes(key).toLowerCase()] = normalizeApostrophes(
        dict[key],
      );
    });
    return out;
  }

  var EXC_CYR_LAT = normalizeDict(EXCEPTIONS_CYR_TO_LAT);
  var EXC_LAT_CYR = normalizeDict(EXCEPTIONS_LAT_TO_CYR);

  function isCyrVowel(ch) {
    return !!ch && CYR_VOWELS.indexOf(ch) !== -1;
  }

  function isLatVowel(ch) {
    return !!ch && LAT_VOWELS.indexOf(ch) !== -1;
  }

  /**
   * Detect the casing pattern of a word and re-apply it to a converted value.
   * @param {string} word      original word (mixed case)
   * @param {string} converted lowercase conversion result
   * @returns {string}
   */
  function applyCase(word, converted) {
    if (!converted) return converted;
    var isAllUpper = word === word.toUpperCase() && word !== word.toLowerCase();
    if (isAllUpper) return converted.toUpperCase();
    var isTitle = !isAllUpper && /^\p{Lu}/u.test(word);
    if (isTitle) return converted.charAt(0).toUpperCase() + converted.slice(1);
    return converted;
  }

  /**
   * Run `mapper` on every word of the text, preserving everything else.
   * @param {string} text
   * @param {(lowerWord: string, originalWord: string) => string} mapper
   */
  function mapWords(text, mapper) {
    return text.replace(WORD_RE, function (word) {
      return mapper(word.toLowerCase(), word);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* 5. Cyrillic -> standard Latin (internal representation)                */
  /* ---------------------------------------------------------------------- */

  function cyrWordToLatin(lowerWord) {
    var exception = EXC_CYR_LAT[lowerWord];
    if (exception !== undefined) return exception;

    var out = "";
    var prev = "";
    for (var i = 0; i < lowerWord.length; i++) {
      var ch = lowerWord[i];
      var val;

      if (ch === "е") {
        /* Ye at the beginning of a word, after a vowel or after ь / ъ. */
        val =
          i === 0 || isCyrVowel(prev) || prev === "ь" || prev === "ъ"
            ? "ye"
            : "e";
      } else if (ch === "ц") {
        /* Ts after a vowel, S at the beginning of a word or after a consonant. */
        val = isCyrVowel(prev) ? "ts" : "s";
      } else if (Object.prototype.hasOwnProperty.call(CYR_TO_LAT, ch)) {
        val = CYR_TO_LAT[ch];
      } else {
        val = ch; /* unknown character -> keep as is */
      }

      out += val;
      prev = ch;
    }
    return out;
  }

  function cyrillicToLatin(text) {
    return mapWords(text, function (lowerWord, originalWord) {
      return applyCase(originalWord, cyrWordToLatin(lowerWord));
    });
  }

  /* ---------------------------------------------------------------------- */
  /* 6. Latin -> Cyrillic                                                    */
  /* ---------------------------------------------------------------------- */

  function latWordToCyrillic(lowerWord) {
    var exception = EXC_LAT_CYR[lowerWord];
    if (exception !== undefined) return exception;

    var out = "";
    var i = 0;
    var len = lowerWord.length;

    while (i < len) {
      var matched = false;

      /* Multi character units first (longest match). */
      for (var d = 0; d < LAT_TO_CYR_DIGRAPHS.length; d++) {
        var key = LAT_TO_CYR_DIGRAPHS[d][0];
        if (lowerWord.substr(i, key.length) !== key) continue;

        /* "yo" followed by the tutuq belgisi is really y + oʻ  (yoʼq -> йўқ) */
        if (key === "yo" && lowerWord[i + 2] === MOD_APOS) continue;

        out += LAT_TO_CYR_DIGRAPHS[d][1];
        i += key.length;
        matched = true;
        break;
      }
      if (matched) continue;

      var ch = lowerWord[i];
      var prev = i > 0 ? lowerWord[i - 1] : "";

      if (ch === MOD_APOS) {
        out += "ъ"; /* tutuq belgisi */
      } else if (ch === "e") {
        /* Word initial / post-vocalic e becomes э, otherwise е. */
        out += i === 0 || isLatVowel(prev) ? "э" : "е";
      } else if (Object.prototype.hasOwnProperty.call(LAT_TO_CYR_SINGLE, ch)) {
        out += LAT_TO_CYR_SINGLE[ch];
      } else {
        out += ch; /* unknown character -> keep */
      }
      i += 1;
    }
    return out;
  }

  function latinToCyrillic(text) {
    return mapWords(text, function (lowerWord, originalWord) {
      return applyCase(originalWord, latWordToCyrillic(lowerWord));
    });
  }

  /* ---------------------------------------------------------------------- */
  /* 7. Standard Latin <-> New (reformed) Latin                              */
  /* ---------------------------------------------------------------------- */

  /* Standard -> New replacements (applied on a word that is already lower-
   * cased internally, then cased back).  Order matters: modifiers first. */
  var LAT_TO_NEW_PAIRS = [
    ["o" + MOD_APOS, "\u014D"], // oʻ  -> ō
    ["g" + MOD_APOS, "\u1E21"], // gʻ  -> ḡ
    ["sh", "\u015F"], // sh  -> ş
    ["ch", "\u00E7"], // ch  -> ç
    ["ng", "\u00F1"], // ng  -> ñ
  ];

  var NEW_TO_LAT_PAIRS = [
    ["\u014D", "o" + MOD_APOS],
    ["\u1E21", "g" + MOD_APOS],
    ["\u015F", "sh"],
    ["\u00E7", "ch"],
    ["\u00F1", "ng"],
  ];

  function replacePairsInWord(lowerWord, pairs) {
    var out = lowerWord;
    pairs.forEach(function (pair) {
      out = out.split(pair[0]).join(pair[1]);
    });
    return out;
  }

  /** Standard Latin -> Reformed Latin. */
  function latinToNewLatin(text) {
    return mapWords(text, function (lowerWord, originalWord) {
      return applyCase(
        originalWord,
        replacePairsInWord(lowerWord, LAT_TO_NEW_PAIRS),
      );
    });
  }

  /** Reformed Latin -> Standard Latin (internal marker form). */
  function newLatinToLatin(text) {
    return mapWords(text, function (lowerWord, originalWord) {
      return applyCase(
        originalWord,
        replacePairsInWord(lowerWord, NEW_TO_LAT_PAIRS),
      );
    });
  }

  /* ---------------------------------------------------------------------- */
  /* 8. Modifier letter emission (internal marker -> official characters)    */
  /* ---------------------------------------------------------------------- */

  /**
   * Emit official 1995 Latin: ʻ after o/g for oʻ & gʻ, ʼ for the tutuq belgisi.
   */
  function emitStandardLatin(text) {
    return text
      .replace(/([oO])\u02BC/g, function (m, c) {
        return c + MOD_TURNED;
      })
      .replace(/([gG])\u02BC/g, function (m, c) {
        return c + MOD_TURNED;
      });
  }

  /* ---------------------------------------------------------------------- */
  /* 9. Public API                                                          */
  /* ---------------------------------------------------------------------- */

  function isValidScript(id) {
    return (
      id === SCRIPTS.CYRILLIC ||
      id === SCRIPTS.LATIN ||
      id === SCRIPTS.NEW_LATIN
    );
  }

  /**
   * Transliterate `text` from one Uzbek script to another.
   *
   * @param {string} text  source text
   * @param {string} from  'cyrl' | 'lat' | 'new'
   * @param {string} to    'cyrl' | 'lat' | 'new'
   * @returns {string} transliterated text
   */
  function transliterate(text, from, to) {
    if (typeof text !== "string" || text.length === 0) return "";
    if (!isValidScript(from) || !isValidScript(to)) return text;

    /* Apostrophes are always canonicalised, even for same-script requests. */
    var normalized = normalizeApostrophes(text);

    if (from === to) {
      if (to === SCRIPTS.LATIN) return emitStandardLatin(normalized);
      if (to === SCRIPTS.NEW_LATIN) return latinToNewLatin(normalized);
      return normalized.split(MOD_APOS).join("ъ");
    }

    /* Step 1: bring the text into the standard-Latin intermediate form. */
    var latin;
    if (from === SCRIPTS.CYRILLIC) latin = cyrillicToLatin(normalized);
    else if (from === SCRIPTS.NEW_LATIN) latin = newLatinToLatin(normalized);
    else latin = normalized;

    /* Step 2: emit the requested target script. */
    if (to === SCRIPTS.CYRILLIC) return latinToCyrillic(latin);
    if (to === SCRIPTS.NEW_LATIN) return latinToNewLatin(latin);
    return emitStandardLatin(latin);
  }

  /* ---------------------------------------------------------------------- */
  /* 10. Export                                                             */
  /* ---------------------------------------------------------------------- */

  var UzTransliterator = {
    SCRIPTS: SCRIPTS,
    MODIFIER_TURNED_COMMA: MOD_TURNED,
    MODIFIER_APOSTROPHE: MOD_APOS,
    normalizeApostrophes: normalizeApostrophes,
    transliterate: transliterate,
    /* exposed for advanced use / tests */
    _internal: {
      cyrillicToLatin: cyrillicToLatin,
      latinToCyrillic: latinToCyrillic,
      latinToNewLatin: latinToNewLatin,
      newLatinToLatin: newLatinToLatin,
      emitStandardLatin: emitStandardLatin,
      exceptions: { cyrToLat: EXC_CYR_LAT, latToCyr: EXC_LAT_CYR },
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = UzTransliterator; /* Node.js (unit tests) */
  }
  global.UzTransliterator = UzTransliterator;
})(typeof window !== "undefined" ? window : globalThis);
