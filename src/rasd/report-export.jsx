// @ts-nocheck
/* eslint-disable */
import { summaryText, summarize, observationLines } from "./observations";
import { buildReportDocx, fetchTemplate } from "./report-docx";
import { datasetLabel } from "./audit-support.js";
import { allDatasets } from "./audit-engine.js";

var Amiri_Regular_default = "/fonts/Amiri-Regular.ttf";
var F = {
  ء: [65152, 0, 0, 0],
  آ: [65153, 65154, 0, 0],
  أ: [65155, 65156, 0, 0],
  ؤ: [65157, 65158, 0, 0],
  إ: [65159, 65160, 0, 0],
  ئ: [65161, 65162, 65163, 65164],
  ا: [65165, 65166, 0, 0],
  ب: [65167, 65168, 65169, 65170],
  ة: [65171, 65172, 0, 0],
  ت: [65173, 65174, 65175, 65176],
  ث: [65177, 65178, 65179, 65180],
  ج: [65181, 65182, 65183, 65184],
  ح: [65185, 65186, 65187, 65188],
  خ: [65189, 65190, 65191, 65192],
  د: [65193, 65194, 0, 0],
  ذ: [65195, 65196, 0, 0],
  ر: [65197, 65198, 0, 0],
  ز: [65199, 65200, 0, 0],
  س: [65201, 65202, 65203, 65204],
  ش: [65205, 65206, 65207, 65208],
  ص: [65209, 65210, 65211, 65212],
  ض: [65213, 65214, 65215, 65216],
  ط: [65217, 65218, 65219, 65220],
  ظ: [65221, 65222, 65223, 65224],
  ع: [65225, 65226, 65227, 65228],
  غ: [65229, 65230, 65231, 65232],
  ف: [65233, 65234, 65235, 65236],
  ق: [65237, 65238, 65239, 65240],
  ك: [65241, 65242, 65243, 65244],
  ل: [65245, 65246, 65247, 65248],
  م: [65249, 65250, 65251, 65252],
  ن: [65253, 65254, 65255, 65256],
  ه: [65257, 65258, 65259, 65260],
  و: [65261, 65262, 0, 0],
  ى: [65263, 65264, 0, 0],
  ي: [65265, 65266, 65267, 65268],
};
var rightOnly = /* @__PURE__ */ new Set("اأإآؤءدذرزوةى");
var unshapeMap = /* @__PURE__ */ new Map();
for (const [base, forms] of Object.entries(F))
  for (const cp of forms)
    if (cp) unshapeMap.set(String.fromCodePoint(cp), base);
var isAr = (c) => F[c] !== void 0;
// مقاطع لاتينية/رقمية (تواريخ، أرقام، مفاتيح الجداول) يجب أن تبقى بترتيبها داخل السطر العربي المعكوس.
var LTR_RUN = /%?[A-Za-z0-9_]+(?:[.,:/-][A-Za-z0-9_]+)*%?/g;
var flipRuns = (s) => s.replace(LTR_RUN, (m) => [...m].reverse().join(""));
function toVisual(text) {
  const chars = [...text];
  const shaped = chars
    .map((c, i) => {
      const forms = F[c];
      if (!forms) return c;
      const prev = chars[i - 1],
        next = chars[i + 1];
      const joinsPrev = prev !== void 0 && isAr(prev) && !rightOnly.has(prev);
      const joinsNext = next !== void 0 && isAr(next);
      const cp =
        joinsPrev && joinsNext && forms[3]
          ? forms[3]
          : joinsPrev && forms[1]
            ? forms[1]
            : joinsNext && forms[2]
              ? forms[2]
              : forms[0];
      return String.fromCodePoint(cp);
    })
    .reverse()
    .join("");
  // العكس الكامل يقلب ترتيب الأرقام والحروف اللاتينية؛ نعيدها لترتيبها الأصلي.
  return flipRuns(shaped);
}
// الصيغة القديمة (قبل إصلاح الأرقام) للتقارير PDF المصدّرة سابقاً.
function fromVisualLegacy(text) {
  return [...text]
    .reverse()
    .map((c) => unshapeMap.get(c) ?? c)
    .join("");
}
function fromVisual(text) {
  return [...flipRuns(text)]
    .reverse()
    .map((c) => unshapeMap.get(c) ?? c)
    .join("");
}
var toBase64 = (buf) => {
  let s = "";
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 32768)
    s += String.fromCharCode(...b.subarray(i, i + 32768));
  return btoa(s);
};
/** يقسّم النص إلى أسطر بحد أقصى n حرفاً دون فقد أي حرف (الكلمة الأطول من n تُقطَّع). */
export function wrapText(text, n = 70) {
  const out = [];
  let cur = "";
  for (const w of String(text ?? "").split(/\s+/).filter(Boolean)) {
    let word = w;
    while (word.length > n) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
      out.push(word.slice(0, n));
      word = word.slice(n);
    }
    if (!cur) cur = word;
    else if (cur.length + 1 + word.length <= n) cur += " " + word;
    else {
      out.push(cur);
      cur = word;
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}
var sevWord = {
  high: "مرتفعة",
  medium: "متوسطة",
  low: "منخفضة",
};
export async function downloadReportPdf(report, datasetLabel) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const font = await fetch(Amiri_Regular_default).then((r) => r.arrayBuffer());
  doc.addFileToVFS("Amiri-Regular.ttf", toBase64(font));
  doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
  doc.setFont("Amiri");
  const X = 200;
  let y = 20;
  const line = (text, size = 12, gap = 7) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(size);
    doc.text(toVisual(text), X, y, { align: "right" });
    y += gap;
  };
  line(report.name, 18, 12);
  line(
    report.kind === "audit"
      ? `التاريخ: ${report.date} · عدد الملاحظات الرقابية: ${report.observations.length}`
      : `التاريخ: ${report.date} · عدد الملاحظات: ${report.findings.length}`,
    11,
    12,
  );
  if (report.kind === "audit") {
    const sum = summaryText(summarize(report.observations));
    wrapText(sum).forEach((c) => line(c, 11, 7));
    if (report.compliance?.pct != null)
      line(`نسبة السجلات الخالية من الملاحظات: ${report.compliance.pct}%`, 11, 10);
    y += 4;
  }
  for (const f of report.kind === "audit" ? [] : report.findings) {
    line(
      `${f.dataset} | ${f.test} | ${f.ref || "—"} | ${sevWord[f.severity]} | ${f.detail || "—"}`,
      11,
    );
    line(`الجدول: ${datasetLabel(f.dataset)}`, 10, 9);
  }
  if (report.kind !== "audit" && !report.findings.length)
    line("لا توجد ملاحظات في هذا التقرير.");
  if (report.observations?.length) {
    line("الملاحظات الرقابية", 15, 10);
    for (const [oi, o] of report.observations.entries()) {
      observationLines(o, sevWord, oi + 1).forEach((t, i) => {
        wrapText(t).forEach((c) => line(c, i === 0 ? 12 : 10, i === 0 ? 7 : 6));
      });
      y += 4;
    }
  }
  doc.save(`${report.name}.pdf`);
}
export async function downloadReportDocx(report, meta) {
  // يُبنى الملف على قالب ديوان المحاسبة نفسه؛ الملاحظات المعتمدة فقط تصل هنا (انظر AuditReport)
  const bytes = await buildReportDocx(await fetchTemplate(), report, meta);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.name}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function parseReportText(text) {
  const out = [];
  const sevOf = (s) =>
    /مرتفع/.test(s)
      ? "high"
      : /متوسط/.test(s)
        ? "medium"
        : /منخفض/.test(s)
          ? "low"
          : void 0;
  for (const raw of text.split("\n")) {
    const t = raw.trim();
    const cur = fromVisual(t);
    const old = fromVisualLegacy(t);
    const known = (l) => allDatasets.some((d) => d.key === (l.split("|")[0] ?? "").trim());
    const line = known(cur) ? cur : known(old) ? old : cur;
    const sev = sevOf(line);
    if (!sev) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 4 && /^[A-Za-z_]+$/.test(parts[0]))
      out.push({
        dataset: parts[0],
        test: parts[1],
        ref: parts[2] === "—" ? "" : (parts[2] ?? ""),
        severity: sev,
        detail: parts.slice(4).join(" | ").replace("—", "").trim(),
      });
    else
      out.push({
        dataset: "",
        test: line.slice(0, 120),
        ref: "",
        severity: sev,
        detail: "",
      });
  }
  return out;
}
