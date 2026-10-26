// Reads table-like rows from a PDF (text-based, not scanned) and maps them to dataset fields.
// Lines are grouped by vertical position; cells are split by horizontal gaps.
// The first line matching any field label/key is treated as the header; otherwise columns map by order.

export function linesToRows(lines, fields) {
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const matchField = (cell) => {
    const c = norm(cell);
    return fields.find((f) => norm(f.label) === c || f.key === c || (c && norm(f.label).startsWith(c)));
  };
  let headerIdx = -1;
  let map = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].map(matchField);
    if (m.filter(Boolean).length >= Math.min(2, fields.length)) {
      headerIdx = i;
      map = m;
      break;
    }
  }
  const body = headerIdx >= 0 ? lines.slice(headerIdx + 1) : lines;
  return body
    .map((cells) => {
      const row = {};
      cells.forEach((c, j) => {
        const f = headerIdx >= 0 ? map[j] : fields[j];
        if (f) row[f.label] = norm(c);
      });
      return row;
    })
    .filter((r) => Object.values(r).some(Boolean));
}

export async function extractPdfRows(file, fields) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    const items = content.items
      .filter((it) => "str" in it && it.str.trim())
      .map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width }));
    const byY = [];
    for (const it of items) {
      const g = byY.find((l) => Math.abs(l.y - it.y) < 3);
      if (g) g.items.push(it);
      else byY.push({ y: it.y, items: [it] });
    }
    byY.sort((a, b) => b.y - a.y);
    for (const l of byY) {
      // Arabic tables read right-to-left: sort by x descending.
      const its = l.items.sort((a, b) => b.x - a.x);
      const cells = [];
      let prev = null;
      for (const it of its) {
        if (prev && prev.x - (it.x + it.w) < 8) cells[cells.length - 1] = it.s + " " + cells[cells.length - 1];
        else cells.push(it.s);
        prev = it;
      }
      lines.push(cells);
    }
  }
  if (!lines.length) throw Error("لم يتم العثور على نص في ملف PDF (قد يكون صورة ممسوحة)");
  return linesToRows(lines, fields);
}
