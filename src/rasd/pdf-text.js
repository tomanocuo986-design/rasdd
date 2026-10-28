// PDF text extraction with an OCR fallback for scanned pages.
// Text PDFs go through pdf.js (fast, exact). A page that yields almost no text is treated as a scan,
// rendered to a canvas and recognised with tesseract.js (Arabic + English).
// NOTE: tesseract.js downloads its engine and the language data from a CDN the first time it runs,
// so OCR needs an internet connection; plain text PDFs do not.

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
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    let t = c.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .trim();
    if (ocr && t.replace(/\s+/g, "").length < MIN_TEXT_CHARS) {
      onStatus?.(`الصفحة ${i} من ${pdf.numPages} ممسوحة ضوئيًا — جارٍ التعرف على النص (OCR)…`);
      try {
        t = await ocrPage(page);
        if (t) ocrPages.push(i);
      } catch {
        /* OCR unavailable (offline / blocked): keep whatever text we have */
      }
    }
    pages.push(t);
  }
  if (ocrPages.length) await terminateOcr();
  return { text: pages.join("\n"), pages, ocrPages };
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
