// Excel serial-date helpers. Excel stores dates as day counts since 1899-12-30
// (25569 = 1970-01-01). A cell whose number format is "General" is read as a plain number
// (e.g. 46315), which would break every date difference unless converted here.

export const EXCEL_EPOCH_OFFSET = 25569;
const MIN_SERIAL = 20000; // ~1954
const MAX_SERIAL = 80000; // ~2119

const pad = (n) => String(n).padStart(2, "0");

/** true when the string looks like an Excel serial number (optionally with a time fraction). */
export const isExcelSerial = (v) => {
  const s = String(v ?? "").trim();
  if (!/^\d{5}(\.\d+)?$/.test(s)) return false;
  const n = parseFloat(s);
  return n >= MIN_SERIAL && n <= MAX_SERIAL;
};

/** Excel serial -> milliseconds (UTC). */
export const serialToMs = (n) => Math.round((n - EXCEL_EPOCH_OFFSET) * 86400000);

/** Excel serial -> "yyyy-mm-dd" (plus " hh:mm" when there is a time part), or "" if out of range. */
export function serialToISO(n) {
  if (!(n >= MIN_SERIAL && n <= MAX_SERIAL)) return "";
  const d = new Date(serialToMs(n));
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return n % 1 ? `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : day;
}

/** Date.parse that also understands Excel serials. Returns ms (UTC) or undefined. */
export function parseDateMs(v) {
  if (isExcelSerial(v)) return serialToMs(parseFloat(String(v).trim()));
  const t = Date.parse(String(v ?? ""));
  return Number.isNaN(t) ? undefined : t;
}
