// Smart table import for Excel / CSV.
// - tolerant header matching (Arabic diacritics, hamza/ya/ta-marbuta variants, spaces, underscores)
// - header row detected anywhere in the first rows (title rows above the table are fine)
// - every sheet is mapped to a dataset: by sheet name first, then by best header overlap
// - dates become yyyy-mm-dd, numbers lose thousands separators, Arabic digits become Latin

import { isExcelSerial, serialToISO } from "./dates.js";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export const latinDigits = (s) =>
  String(s ?? "").replace(/[٠-٩۰-۹]/g, (c) => {
    const i = AR_DIGITS.indexOf(c);
    return String(i >= 0 ? i : FA_DIGITS.indexOf(c));
  });

export const normText = (s) =>
  latinDigits(s)
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/[_\-./\\()[\]{}:؛،,*#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// 3 = exact, 2 = one contains the other, 0 = no match
export function cellScore(cell, field) {
  const c = normText(cell);
  if (!c) return 0;
  const label = normText(field.label);
  const key = normText(field.key);
  if (c === label || c === key) return 3;
  if (c.length >= 3 && label.length >= 3 && (label.includes(c) || c.includes(label)))
    return 2;
  if (c.length >= 4 && key.length >= 4 && (key.includes(c) || c.includes(key))) return 2;
  return 0;
}

// Maps column index -> field for one header row (each field used once, best score wins).
export function mapHeader(cells, fields) {
  const cand = [];
  cells.forEach((cell, j) => {
    fields.forEach((f) => {
      const s = cellScore(cell, f);
      if (s) cand.push({ j, f, s });
    });
  });
  cand.sort((a, b) => b.s - a.s || a.j - b.j);
  const usedCol = new Set();
  const usedField = new Set();
  const map = [];
  for (const { j, f, s } of cand) {
    if (usedCol.has(j) || usedField.has(f.key)) continue;
    usedCol.add(j);
    usedField.add(f.key);
    map[j] = f;
    void s;
  }
  return { map, matched: usedField.size };
}

// aoa = array of arrays (strings). Returns the best header row for these fields.
export function detectHeader(aoa, fields, scan = 40) {
  let best = { idx: -1, map: [], matched: 0 };
  const lim = Math.min(aoa.length, scan);
  for (let i = 0; i < lim; i++) {
    const r = mapHeader(aoa[i] ?? [], fields);
    if (r.matched > best.matched) best = { idx: i, ...r };
  }
  return best;
}

function cleanValue(v, field) {
  let s = latinDigits(String(v ?? "")).replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "").trim();
  // Real Excel dates in a "General"-formatted cell arrive as serial numbers (e.g. 46315).
  if (field.type === "date" && isExcelSerial(s)) {
    s = serialToISO(parseFloat(s)) || s;
  }
  if (field.type === "number" && s) {
    s = s.replace(/[٬,\s]/g, "").replace(/٫/g, ".").replace(/%$/, "");
  }
  return s;
}

export function rowsFromAoa(aoa, fields, header) {
  const h = header ?? detectHeader(aoa, fields);
  if (h.idx < 0) return { rows: [], matched: 0, headerRow: -1 };
  const rows = [];
  for (let i = h.idx + 1; i < aoa.length; i++) {
    const src = aoa[i] ?? [];
    const row = {};
    fields.forEach((f) => (row[f.key] = ""));
    src.forEach((cell, j) => {
      const f = h.map[j];
      if (f) row[f.key] = cleanValue(cell, f);
    });
    if (Object.values(row).some(Boolean)) rows.push(row);
  }
  return { rows, matched: h.matched, headerRow: h.idx };
}

const pad = (n) => String(n).padStart(2, "0");

function cellText(X, cell) {
  if (!cell) return "";
  if (cell.t === "n" && typeof cell.v === "number") {
    const isDate = cell.z && X.SSF && X.SSF.is_date && X.SSF.is_date(cell.z);
    if (isDate) {
      const p = X.SSF.parse_date_code(cell.v);
      if (p) {
        const d = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
        return p.H || p.M || p.S ? `${d} ${pad(p.H)}:${pad(p.M)}` : d;
      }
    }
    return String(cell.v);
  }
  if (cell.t === "d" && cell.v instanceof Date) {
    const d = cell.v;
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return String(cell.w ?? cell.v ?? "");
}

export function sheetToAoa(X, sheet) {
  const ref = sheet && sheet["!ref"];
  if (!ref) return [];
  const range = X.utils.decode_range(ref);
  const aoa = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      row.push(cellText(X, sheet[X.utils.encode_cell({ r, c })]));
    }
    aoa.push(row);
  }
  return aoa;
}

// Maps every sheet of a workbook onto datasets.
// datasets: [{ key, label, fields }]; preferKey: currently open dataset (wins ties)
export function mapWorkbook(X, wb, datasets, preferKey) {
  return mapSheets(
    wb.SheetNames.map((name) => ({ name, aoa: sheetToAoa(X, wb.Sheets[name]) })),
    datasets,
    preferKey,
  );
}

// Same mapping for any tabular source (JSON / XML / CSV): sheets = [{ name, aoa }]
export function mapSheets(sheets, datasets, preferKey) {
  const imports = [];
  const unmatched = [];
  for (const { name, aoa: rawAoa } of sheets) {
    const aoa = rawAoa.filter((r) => r.some((c) => String(c).trim()));
    if (!aoa.length) continue;
    const nn = normText(name);
    let pick = null;

    const byName = datasets.find(
      (d) => nn && (nn === normText(d.key) || nn === normText(d.label)),
    );
    if (byName) {
      const h = detectHeader(aoa, byName.fields);
      if (h.matched >= Math.min(2, byName.fields.length)) pick = { d: byName, h };
    }
    if (!pick) {
      let best = null;
      for (const d of datasets) {
        const h = detectHeader(aoa, d.fields);
        const need = Math.max(2, Math.ceil(d.fields.length * 0.4));
        if (h.matched < need) continue;
        const ratio = h.matched / d.fields.length;
        const score = h.matched + ratio + (d.key === preferKey ? 0.01 : 0);
        if (!best || score > best.score) best = { d, h, score };
      }
      if (best) pick = best;
    }
    if (!pick) {
      const hdr = aoa.slice(0, 5).find((r) => r.filter((c) => String(c).trim()).length >= 2) ?? aoa[0];
      unmatched.push({ sheet: name, headers: hdr.map((c) => String(c).trim()).filter(Boolean) });
      continue;
    }
    const { rows, matched } = rowsFromAoa(aoa, pick.d.fields, pick.h);
    if (rows.length) {
      imports.push({
        sheet: name,
        key: pick.d.key,
        label: pick.d.label,
        rows,
        matched,
        total: pick.d.fields.length,
      });
    } else {
      unmatched.push({ sheet: name, headers: [], empty: true });
    }
  }
  return { imports, unmatched };
}
