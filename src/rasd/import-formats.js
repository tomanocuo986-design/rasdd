// Extra import formats for municipal exports: JSON and XML -> array-of-arrays ("sheets"), which then go through the
// same header matching / dataset detection as Excel and CSV (mapSheets in import-table.js).
// Also: chunked row conversion so a very large file never freezes the UI.
import { rowsFromAoa } from "./import-table.js";

const scalar = (v) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Flattens {a:{b:1}} to {"a.b":"1"}; arrays of scalars are joined with "، ". */
export function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) out[key] = v.every((x) => x == null || typeof x !== "object") ? v.map(scalar).join("، ") : JSON.stringify(v);
    else if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = scalar(v);
  }
  return out;
}

/** Array of records -> aoa (header = union of keys in first-seen order). */
export function recordsToAoa(records) {
  const flat = records.map((r) => flatten(r && typeof r === "object" ? r : { value: r }));
  const header = [];
  const seen = new Set();
  for (const r of flat)
    for (const k of Object.keys(r)) if (!seen.has(k)) (seen.add(k), header.push(k));
  return [header, ...flat.map((r) => header.map((k) => r[k] ?? ""))];
}

const isRecordArray = (v) => Array.isArray(v) && v.length > 0 && v.some((x) => x && typeof x === "object");

/**
 * JSON text -> [{ name, aoa }]. Accepts: [ {...} ]  |  { rows:[...] }  |  { "Sheet A":[...], "Sheet B":[...] }
 * (one level of wrapping, e.g. {"data":{"items":[...]}}, is also searched).
 */
export function jsonToSheets(text) {
  let root;
  try {
    root = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw Error("ملف JSON غير صالح (تحقق من الأقواس والفواصل)");
  }
  if (isRecordArray(root)) return [{ name: "JSON", aoa: recordsToAoa(root) }];
  const sheets = [];
  const walk = (o, path, depth) => {
    if (!o || typeof o !== "object" || Array.isArray(o)) return;
    for (const [k, v] of Object.entries(o)) {
      if (isRecordArray(v)) sheets.push({ name: path ? `${path}.${k}` : k, aoa: recordsToAoa(v) });
      else if (depth < 2) walk(v, path ? `${path}.${k}` : k, depth + 1);
    }
  };
  walk(root, "", 0);
  if (!sheets.length) throw Error("لم يُعثر في ملف JSON على مصفوفة سجلات");
  return sheets;
}

// ---- XML (small, dependency-free, tolerant parser; enough for tabular exports) ----

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unent = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });

function parseXml(text) {
  const src = text.replace(/^﻿/, "");
  const root = { name: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!(?!\[)[^>]*>|<\/\s*([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2] !== undefined) {
      if (stack.length > 1) stack.pop();
    } else if (m[3] !== undefined) {
      const attrs = {};
      for (const a of m[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = unent(a[2] ?? a[3] ?? "");
      const el = { name: m[3], attrs, children: [], text: "" };
      top.children.push(el);
      if (!m[5]) stack.push(el);
    } else if (m[6] !== undefined) top.text += unent(m[6]);
    if (stack.length > 200) throw Error("ملف XML متداخل بعمق غير معتاد");
  }
  return root;
}

function elementToRecord(el, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(el.attrs)) out[prefix + k] = v;
  const counts = {};
  for (const c of el.children) counts[c.name] = (counts[c.name] ?? 0) + 1;
  const idx = {};
  for (const c of el.children) {
    const name = counts[c.name] > 1 ? `${c.name}[${(idx[c.name] = (idx[c.name] ?? 0) + 1)}]` : c.name;
    if (c.children.length || Object.keys(c.attrs).length) {
      elementToRecord(c, `${prefix}${name}.`, out);
      if (c.text.trim() && !c.children.length) out[`${prefix}${name}`] = c.text.trim();
    } else out[`${prefix}${name}`] = c.text.trim();
  }
  return out;
}

// the record element = most repeated child name under any node (ties: the deepest / first)
function findRecords(node) {
  let best = null;
  const visit = (n, depth) => {
    const groups = {};
    for (const c of n.children) (groups[c.name] ??= []).push(c);
    for (const list of Object.values(groups))
      if (!best || list.length > best.list.length || (list.length === best.list.length && depth > best.depth))
        best = { list, depth };
    n.children.forEach((c) => visit(c, depth + 1));
  };
  // the document element itself is never a record: only repeated/child elements below it are
  node.children.forEach((c) => visit(c, 1));
  return best?.list ?? [];
}

/** XML text -> [{ name, aoa }] (one sheet: the repeating element becomes the row). */
export function xmlToSheets(text) {
  const records = findRecords(parseXml(text));
  if (!records.length) throw Error("لم يُعثر في ملف XML على سجلات متكررة");
  const flat = records.map((r) => elementToRecord(r));
  return [{ name: records[0].name, aoa: recordsToAoa(flat) }];
}

// ---- chunking ----

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * Same result as rowsFromAoa(), but processes `chunk` rows at a time and yields to the event loop in between,
 * reporting progress. Keeps the UI responsive for municipal-size files (hundreds of thousands of rows).
 */
export async function rowsFromAoaChunked(aoa, fields, { chunk = 5000, onProgress, yieldFn = tick } = {}) {
  const head = rowsFromAoa(aoa.slice(0, Math.min(aoa.length, 60)), fields);
  if (head.headerRow < 0) return { rows: [], matched: 0, headerRow: -1 };
  // header row already found in the first 60 rows: re-use its mapping for the rest so every chunk maps identically
  const headerRow = head.headerRow;
  const out = [];
  const total = aoa.length - headerRow - 1;
  for (let start = headerRow + 1; start < aoa.length; start += chunk) {
    const part = [aoa[headerRow], ...aoa.slice(start, start + chunk)];
    out.push(...rowsFromAoa(part, fields).rows);
    onProgress?.(Math.min(1, (start - headerRow - 1 + chunk) / Math.max(1, total)));
    if (start + chunk < aoa.length) await yieldFn();
  }
  return { rows: out, matched: head.matched, headerRow };
}
