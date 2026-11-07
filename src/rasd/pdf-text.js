// PDF text extraction with an OCR fallback for scanned pages.
// Text PDFs go through pdf.js (fast, exact). A page that yields almost no text is treated as a scan,
// rendered to a canvas and recognised with tesseract.js (Arabic + English).
// NOTE: tesseract.js downloads its engine and the language data from a CDN the first time it runs,
// so OCR needs an internet connection; plain text PDFs do not.

import { garbleRatio, isGarbled, looksReversed, normalizeArabic, repairKashida, unreverse } from "./arabic-text.js";

export const MIN_TEXT_CHARS = 25; // fewer characters than this on a page => treat the page as scanned
const OCR_LANGS = "ara+eng";
const OCR_SCALE = 2.2;

async function loadPdf(file) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}

let ocrWorker = null;
async function getOcrWorker(onProgress) {
  if (!ocrWorker) {
    const T = await import("tesseract.js");
    ocrWorker = await T.createWorker(OCR_LANGS, 1, {
      logger: (m) => onProgress && m.status === "recognizing text" && onProgress(m.progress),
    });
  }
  return ocrWorker;
}

export async function terminateOcr() {
  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
  }
}

/** Renders one pdf.js page to a canvas and returns the recognised text (lines joined by \n). */
export async function ocrPage(page, onProgress) {
  const viewport = page.getViewport({ scale: OCR_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport, canvas }).promise;
  const w = await getOcrWorker(onProgress);
  const { data } = await w.recognize(canvas);
  return String(data.text ?? "").trim();
}

/**
 * Extracts the text of every page.
 * opts.ocr (default true): fall back to OCR on pages with no text layer.
 * opts.onStatus(msg): optional progress callback (Arabic messages for the UI).
 * Returns { text, pages, ocrPages } where ocrPages = page numbers that went through OCR.
 */
export async function extractPdfPages(file, opts = {}) {
  const { ocr = true, onStatus } = opts;
  const pdf = await loadPdf(file);
  const pages = [];
  const ocrPages = [];
  const repairedPages = []; // صفحات أُصلحت بالقواعد فقط (تقريبي): الأفضل إعادة رفعها مع الإنترنت ليستعمل OCR
  const garbledPages = []; // صفحات بقي فيها تلف رغم الإصلاح: تُستبعد مقاطعها من السند القانوني
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    let strs = c.items.map((it) => ("str" in it ? normalizeArabic(it.str) : ""));
    if (looksReversed(strs.join(" "))) strs = strs.map(unreverse); // ملف مستخرج بترتيب بصري معكوس
    let t = strs.join(" ").trim();
    const scanned = t.replace(/\s+/g, "").length < MIN_TEXT_CHARS;
    // نص تالف (كشيدة مقروءة حروفًا مثل «تجزئههههة»): نعيد قراءة الصفحة بصريًا بـ OCR
    const broken = !scanned && isGarbled(t, 0.01);
    if (ocr && (scanned || broken)) {
      onStatus?.(
        `الصفحة ${i} من ${pdf.numPages} ${scanned ? "ممسوحة ضوئيًا" : "نصها المستخرج تالف"} — جارٍ التعرف على النص (OCR)…`,
      );
      try {
        const o = normalizeArabic(await ocrPage(page));
        if (o && (scanned || garbleRatio(o) < garbleRatio(t))) {
          t = o;
          ocrPages.push(i);
        }
      } catch {
        /* OCR unavailable (offline / blocked): keep whatever text we have */
      }
    }
    if (broken && !ocrPages.includes(i)) {
      t = repairKashida(t);
      repairedPages.push(i);
    }
    if (isGarbled(t)) garbledPages.push(i);
    pages.push(t);
  }
  if (ocrPages.length) await terminateOcr();
  return { text: pages.join("\n"), pages, ocrPages, repairedPages, garbledPages };
}

export async function extractPdfText(file, opts) {
  return (await extractPdfPages(file, opts)).text;
}

/** OCR text -> table cells: columns in scanned tables are separated by wide gaps. */
export const ocrTextToLines = (text) =>
  String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      l
        .split(/\s{2,}|\t|\|/)
        .map((c) => c.trim())
        .filter(Boolean),
    );
