// @ts-nocheck
/* eslint-disable */
// Ported from Logolabs/agate-webgpu (MIT).
// Agate Preview 003 prompt pipeline, a line-by-line port of agate/prompt_norm.py (+ AgatePipeline.prepare
// and prompt_norm.count_tensor) of Logolabs/agate-preview-003. Checked against the Python package by
// test/prompt_golden.json (tools: export/prompt_golden.py writes it, test/prompt_golden.mjs or ?golden=1 checks it).
//
// Python-compatibility notes (the reason for the helpers below):
//  * Python's \s, \d, \b and str.isalnum/isspace are Unicode-aware; JS's are ASCII. PY_WS, \p{Nd} and the
//    Unicode word-boundary WB mirror Python's definitions (\w = letters, numbers, underscore).
//  * Python counts code points; JS strings count UTF-16 units. Lengths that gate behaviour use cpLen().
//  * Token offsets come from the HF fast tokenizer in Python; here they are rebuilt from the byte-level BPE
//    tokens (tokenOffsets), in UTF-16 units, which gives the same overlaps as Python's code-point offsets.

const PY_WS = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const S = `[${PY_WS}]`;                         // Python's \s
const NS = `[^${PY_WS}]`;                       // Python's \S
const W = "[\\p{L}\\p{N}_]";                    // Python's \w (str patterns)
const WB = `(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))`;   // Python's \b
const D = "\\p{Nd}";                            // Python's \d
const re = (src, flags = "") => new RegExp(src, flags.includes("u") ? flags : flags + "u");

const NUM_LIST = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
const NUM_WORDS = new Map(NUM_LIST.map((w, i) => [w, i]));
NUM_WORDS.set("dozen", 12);
const WORD_OF = new Map(NUM_LIST.map((w, i) => [i, w]));
const NOT_COUNT_NEXT = new Set(["pm", "am", "o'clock", "percent", "%", "years", "year", "hours", "hour", "minutes", "minute",
  "seconds", "second", "times", "px", "cm", "mm", "m", "km", "kg", "g", "inch", "inches", "feet",
  "degrees", "x", "d", "k", "th", "st", "nd", "rd", "of", "o"]);
const ONE_PRONOUN_PREV = new Set(["the", "this", "that", "no", "each", "every", "any", "some", "which", "another", "someone",
  "everyone", "anyone", "only"]);
export const SPELL_SEP = " || spell: ";
const SPELL_MAX_FRAC = 0.6, SPELL_MAX_CHARS = 40, SPELL_MAX_WORDS = 6, SPELL_MAX_SPANS = 3;

const QUOTE_SRC = '"[^"]*"|“[^”]*”';
const cpLen = (s) => { let n = 0; for (const _ of s) n++; return n; };     // len() in Python
const isSpace = (ch) => re(`^${S}$`).test(ch);
const pyStrip = (s, chars = null) => {
  const f = chars === null ? isSpace : (c) => chars.includes(c);
  let a = 0, b = s.length;
  while (a < b && f(s[a])) a++;
  while (b > a && f(s[b - 1])) b--;
  return s.slice(a, b);
};
const pySplit = (s) => s.split(re(`${S}+`)).filter((x) => x.length > 0);   // str.split()
const isAlnum = (ch) => /^[\p{L}\p{N}]$/u.test(ch);
const isAlpha = (w) => w.length > 0 && /^\p{L}+$/u.test(w);
const isUpper = (w) => w !== w.toLowerCase() && w === w.toUpperCase();     // ASCII words only reach these
const isLower = (w) => w !== w.toUpperCase() && w === w.toLowerCase();
const isDigits = (w) => /^\p{Nd}+$/u.test(w);

function digitValue(cp) {              // value of one \p{Nd} code point: Nd code points come in runs of ten
  let start = cp;
  while (/\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
  return (cp - start) % 10;
}
function pyInt(w) {                    // int() of a \p{Nd}+ string
  let n = 0;
  for (const ch of w) n = n * 10 + digitValue(ch.codePointAt(0));
  return n;
}

function outsideQuotes(text) {
  const spans = [];
  let last = 0;
  for (const m of text.matchAll(re(QUOTE_SRC, "g"))) { spans.push([last, m.index]); last = m.index + m[0].length; }
  spans.push([last, text.length]);
  return spans.filter(([a, b]) => b > a);
}

function mapOutside(text, fn) {
  let out = "", last = 0;
  for (const [a, b] of outsideQuotes(text)) { out += text.slice(last, a) + fn(text.slice(a, b)); last = b; }
  return out + text.slice(last);
}

function fixCase(words) {
  const long2 = words.filter((w) => cpLen(w) >= 2 && isAlpha(w));
  if (long2.length && long2.filter(isUpper).length / long2.length >= 0.6) return "shout";
  const long3 = words.filter((w) => cpLen(w) >= 3 && isAlpha(w));
  if (long3.length >= 3) {
    const t = long3.filter((w) => { const c = [...w]; return isUpper(c[0]) && isLower(c.slice(1).join("")); }).length;
    if (t / long3.length >= 0.7) return "title";
  }
  return null;
}

export function isJsonCaption(text) {
  const s = pyStrip(text.split(SPELL_SEP)[0]);
  if (!(s.startsWith("{") && s.endsWith("}"))) return false;
  try { const v = JSON.parse(s); return v !== null && typeof v === "object" && !Array.isArray(v); } catch { return false; }
}

function isCountContext(seg, end) {
  const nxt = re(`^${S}*([A-Za-z%']+)`).exec(seg.slice(end));
  return !!nxt && !NOT_COUNT_NEXT.has(nxt[1].toLowerCase());
}

function canonNumbers(seg) {
  return seg.replace(re(`${WB}[A-Za-z]+${WB}|${WB}${D}+${WB}`, "g"), (w, off) => {
    const lw = w.toLowerCase();
    if (NUM_WORDS.has(lw)) return lw;
    if (isDigits(w)) { const n = pyInt(w); if (n >= 1 && n <= 20 && isCountContext(seg, off + w.length)) return WORD_OF.get(n); }
    return w;
  });
}

export function normalize(text) {
  if (isJsonCaption(text)) return text;
  text = pyStrip(text.replace(re(`${S}+`, "g"), " "));
  const words = [];
  for (const [a, b] of outsideQuotes(text)) for (const m of text.slice(a, b).matchAll(re(`[A-Za-z][A-Za-z'\\-]*|${D}+`, "g"))) words.push(m[0]);
  const mode = fixCase(words);
  if (mode === "shout") text = mapOutside(text, (s) => s.toLowerCase());
  else if (mode === "title") {
    const first = re(`^${S}*${NS}+`).exec(text);
    const head = first ? first[0].length : 0;
    text = text.slice(0, head) + mapOutside(text.slice(head), (s) => s.replace(re(`${WB}[A-Z][a-z]*${WB}`, "g"), (m) => m.toLowerCase()));
  }
  return mapOutside(text, canonNumbers);
}

export function findCounts(text) {
  const out = [];
  if (isJsonCaption(text)) return out;
  text = text.split(SPELL_SEP)[0];
  for (const [a, b] of outsideQuotes(text)) {
    const seg = text.slice(a, b);
    const pat = re(`${WB}(?:a${S}+)?(dozen|pair(?=${S}+of${WB}))${WB}|${WB}([A-Za-z]+|${D}+)${WB}`, "gd");
    for (const m of seg.matchAll(pat)) {
      if (m[1] !== undefined) {
        const [s1, e1] = m.indices[1];
        out.push([a + s1, a + e1, m[1].toLowerCase() === "dozen" ? 12 : 2]);
        continue;
      }
      const w = m[2], lw = w.toLowerCase();
      const [s2, e2] = m.indices[2];
      let n;
      if (isDigits(lw)) { n = pyInt(lw); if (!(n >= 1 && n <= 99)) continue; }
      else if (NUM_WORDS.has(lw) && lw !== "zero" && lw !== "dozen") n = NUM_WORDS.get(lw);
      else continue;
      if (!isCountContext(seg, m.index + m[0].length)) continue;
      const prev = seg.slice(0, m.index).match(/[A-Za-z]+/g) || [];
      if (lw === "one" && prev.length && ONE_PRONOUN_PREV.has(prev[prev.length - 1].toLowerCase())) continue;
      out.push([a + s2, a + e2, n]);
    }
  }
  return out;
}

export function textSpans(text) {
  const body = text.split(SPELL_SEP)[0];
  const out = [];
  for (const m of body.matchAll(re(QUOTE_SRC, "g"))) {
    const c = pyStrip(m[0].slice(1, -1));
    if (c && [...c].some(isAlnum) && cpLen(c) <= SPELL_MAX_FRAC * cpLen(body) && cpLen(c) <= SPELL_MAX_CHARS && pySplit(c).length <= SPELL_MAX_WORDS) out.push(c);
  }
  return out.slice(0, SPELL_MAX_SPANS);
}

export function spell(content) {
  const words = pySplit(content).map((w) => [...w].filter((ch) => isAlnum(ch) || "&!?'-".includes(ch)));
  return words.filter((w) => w.length).map((w) => w.join(" ")).join(" / ");
}

export function addSpelling(text) {
  if (text.includes(SPELL_SEP) || isJsonCaption(text)) return text;
  const spans = textSpans(text);
  if (!spans.length) return text;
  return text + SPELL_SEP + spans.map(spell).join(" ; ");
}

export function splitNegatives(text) {
  const negs = [];
  if (isJsonCaption(text)) return [text, negs];
  const pat = re(`${S}*,?${S}*${WB}(?:with${S}+)?(?:without|no)${S}+(?:any${S}+)?(?:a${S}+|an${S}+|the${S}+)?([^,.;"“]+?)(?=${S}+and${S}+|[,.;]|$)`, "gi");
  const cut = (seg) => seg.replace(pat, (...g) => { negs.push(pyStrip(g[1])); return ""; });
  let pos = mapOutside(text, cut);
  pos = pyStrip(pos.replace(re(`${S}+([,.;])`, "g"), "$1").replace(re(`${S}+`, "g"), " "), " ,;");
  return [pos, negs];
}

// AgatePipeline.prepare: -> [prompt as the text encoder sees it, negative prompt]
export function prepare(prompt, negativePrompt = "", normalizeOn = true, spellOn = true) {
  let negs = [];
  if (normalizeOn) [prompt, negs] = splitNegatives(normalize(prompt));
  if (spellOn) prompt = addSpelling(prompt);
  const negative = [pyStrip(negativePrompt), ...negs].filter((n) => n).join(", ");
  return [prompt, negative];
}

// ---- token offsets for a byte-level BPE tokenizer (tokenizers.js has no offset mapping) -----------
let BYTE_OF = null;                       // GPT-2 bytes_to_unicode, inverted: char -> byte
function byteDecoder() {
  if (BYTE_OF) return BYTE_OF;
  const bs = [];
  for (let b = 33; b <= 126; b++) bs.push(b);
  for (let b = 161; b <= 172; b++) bs.push(b);
  for (let b = 174; b <= 255; b++) bs.push(b);
  const cs = bs.slice();
  let n = 0;
  for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
  BYTE_OF = new Map(bs.map((b, i) => [String.fromCodePoint(cs[i]), b]));
  return BYTE_OF;
}

// ids: the token ids of `text` ([CLS] ... [SEP]). -> [[start, end], ...] in UTF-16 units of text, [0, 0] for
// special tokens: Python's offset_mapping (code points) mapped to JS string indices.
export function tokenOffsets(tok, text, ids) {
  const dec = byteDecoder();
  const nfc = text.normalize("NFC");
  const enc = new TextEncoder();
  // byte index -> [UTF-16 start, UTF-16 end] of the character that byte belongs to
  const charOfByte = [];
  let u = 0;
  for (const ch of nfc) { const nb = enc.encode(ch).length; for (let k = 0; k < nb; k++) charOfByte.push([u, u + ch.length]); u += ch.length; }
  const added = tok.get_added_tokens_decoder?.() ?? new Map();
  const out = [];
  let pos = 0;
  for (const id of ids) {
    const at = added.get(Number(id));
    let nbytes;
    if (at && at.special) { out.push([0, 0]); continue; }
    if (at) nbytes = enc.encode(at.content).length;
    else {
      const s = tok.id_to_token(Number(id));
      nbytes = 0;
      for (const ch of s) nbytes += dec.has(ch) ? 1 : enc.encode(ch).length;
    }
    if (nbytes === 0 || pos >= charOfByte.length) { out.push([0, 0]); continue; }
    const a = charOfByte[pos][0], b = charOfByte[Math.min(pos + nbytes, charOfByte.length) - 1][1];
    out.push([a, b]);
    pos += nbytes;
  }
  // text that NFC changed: offsets refer to the NFC string; the count spans are found in the NFC string too
  return out;
}

// prompt_norm.count_tensor for one prompt: Float32Array(length), the count value at the tokens that spell one.
export function countVector(tok, text, ids, length) {
  const out = new Float32Array(length);
  const nfc = text.normalize("NFC");
  const spans = findCounts(nfc);
  if (!spans.length) return out;
  const offs = tokenOffsets(tok, nfc, ids);
  for (let j = 0; j < Math.min(length, offs.length); j++) {
    const [a, b] = offs[j];
    if (b <= a) continue;
    for (const [s, e, n] of spans) if (a < e && b > s) out[j] = n;
  }
  return out;
}
