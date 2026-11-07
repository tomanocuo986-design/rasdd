// @ts-nocheck
/**
 * تصدير التقرير الرقابي بصيغة Word على قالب ديوان المحاسبة («نموذج تقرير رقابي مقترح»).
 * لا يُبنى المستند من الصفر: يُفتح القالب نفسه (الغلاف، جدول المحتويات، الأقسام أ–د، الخطوط والألوان)
 * ثم يُستنسخ منه جدول «الملاحظة المفصلة» لكل ملاحظة، ويُملأ جدول «قائمة الملاحظات»، ويُختار «الاستنتاج العام»
 * بحسب قاعدة القالب نفسها (عدد الملاحظات المرتفعة ونسبتها). لا يُولَّد هنا أي نص قانوني: السند يُنقل كما هو في الملاحظة.
 */
import JSZip from "jszip";

export const TEMPLATE_URL = "/templates/audit-report-template.docx";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const FONT = "Al-Jazeera-Arabic-Regular";
const SEV_WORD = { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" };
const SEV_ORDER = { high: 0, medium: 1, low: 2 };

/* ------------------------------ أدوات DOM ------------------------------ */
const el = (doc, name, attrs = {}) => {
  const e = doc.createElementNS(W, `w:${name}`);
  for (const [k, v] of Object.entries(attrs)) e.setAttributeNS(W, `w:${k}`, v);
  return e;
};
const kids = (p, name) => [...p.childNodes].filter((n) => n.nodeType === 1 && n.localName === name && n.namespaceURI === W);
const all = (p, name) => [...p.getElementsByTagNameNS(W, name)];
const textOf = (n) => all(n, "t").map((t) => t.textContent).join("");
const rows = (tbl) => kids(tbl, "tr");
const cells = (tr) => kids(tr, "tc");

function runProps(doc, { bold = false, size = 24, color } = {}) {
  const rPr = el(doc, "rPr");
  rPr.appendChild(el(doc, "rFonts", { ascii: FONT, hAnsi: FONT, cs: FONT }));
  if (bold) {
    rPr.appendChild(el(doc, "b"));
    rPr.appendChild(el(doc, "bCs"));
  }
  if (color) rPr.appendChild(el(doc, "color", { val: color }));
  rPr.appendChild(el(doc, "sz", { val: String(size) }));
  rPr.appendChild(el(doc, "szCs", { val: String(size) }));
  rPr.appendChild(el(doc, "rtl"));
  return rPr;
}

function run(doc, text, opts) {
  const r = el(doc, "r");
  r.appendChild(runProps(doc, opts));
  const t = el(doc, "t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = text;
  r.appendChild(t);
  return r;
}

function para(doc, parts, { jc = "both", after = 100 } = {}) {
  const p = el(doc, "p");
  const pPr = el(doc, "pPr");
  pPr.appendChild(el(doc, "pStyle", { val: "NoSpacing" }));
  pPr.appendChild(el(doc, "bidi"));
  pPr.appendChild(el(doc, "spacing", { after: String(after) }));
  pPr.appendChild(el(doc, "jc", { val: jc }));
  p.appendChild(pPr);
  for (const part of parts) p.appendChild(part);
  return p;
}

function clearParas(tc) {
  kids(tc, "p").forEach((p) => tc.removeChild(p));
}

/** يضع فقرات في خلية (يحذف الفقرات الفارغة السابقة) مع إبقاء فقرة واحدة على الأقل كما يوجب Word. */
function setCellParas(tc, paras) {
  clearParas(tc);
  paras.forEach((p) => tc.appendChild(p));
}

/** يضيف نصاً إلى فقرة الخلية الأولى مع نسخ خصائص خط الفقرة (الخلية الفارغة في القالب تحمل الخط في pPr/rPr). */
function fillCell(doc, tc, text, { bold } = {}) {
  const p = kids(tc, "p")[0];
  if (!p) return;
  const existing = all(p, "t");
  if (existing.length) {
    existing[0].textContent = text;
    existing.slice(1).forEach((t) => (t.textContent = ""));
    return;
  }
  const pPr = kids(p, "pPr")[0];
  const base = pPr && kids(pPr, "rPr")[0];
  const r = el(doc, "r");
  const rPr = base ? base.cloneNode(true) : el(doc, "rPr");
  if (bold && !kids(rPr, "b").length) rPr.insertBefore(el(doc, "b"), kids(rPr, "color")[0] ?? kids(rPr, "sz")[0] ?? null);
  if (!kids(rPr, "rtl").length) rPr.insertBefore(el(doc, "rtl"), kids(rPr, "lang")[0] ?? null);
  r.appendChild(rPr);
  const t = el(doc, "t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = text;
  r.appendChild(t);
  p.appendChild(r);
}

/** حقل Word مركّب (PAGEREF مثلاً) يُحدَّث عند فتح الملف. */
function fieldRuns(doc, instr, shown) {
  const mk = (type) => {
    const r = el(doc, "r");
    r.appendChild(runProps(doc, { size: 24 }));
    r.appendChild(el(doc, "fldChar", { fldCharType: type }));
    return r;
  };
  const it = el(doc, "r");
  it.appendChild(runProps(doc, { size: 24 }));
  const ins = el(doc, "instrText");
  ins.setAttribute("xml:space", "preserve");
  ins.textContent = ` ${instr} `;
  it.appendChild(ins);
  return [mk("begin"), it, mk("separate"), run(doc, shown, { size: 24 }), mk("end")];
}

/** استبدال نص في فقرة ولو تشظّى على عدة runs: يوضع الناتج في أول run وتُفرَّغ البقية (تنسيق أول run هو الباقي). */
function replaceInPara(p, fn) {
  const ts = all(p, "t");
  if (!ts.length) return false;
  const before = ts.map((t) => t.textContent).join("");
  const after = fn(before);
  if (after === before) return false;
  ts[0].textContent = after;
  ts[0].setAttribute("xml:space", "preserve");
  ts.slice(1).forEach((t) => (t.textContent = ""));
  return true;
}

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/* ------------------------------ الاستنتاج العام ------------------------------ */
/**
 * قاعدة القالب: لا مرتفعة ولا متوسطة => الاستنتاج الأول؛ 3 مرتفعة فأكثر أو أكثر من 25% مرتفعة => الثالث؛
 * وما بينهما (1–2 مرتفعة أو 25% أو وجود متوسطة) => الثاني.
 */
export function conclusionLevel(list) {
  const n = list.length;
  const high = list.filter((o) => o.risk.rating === "high").length;
  const medium = list.filter((o) => o.risk.rating === "medium").length;
  if (n === 0 || (high === 0 && medium === 0)) return 1;
  if (high >= 3 || (n > 0 && high / n > 0.25)) return 3;
  return 2;
}

/* ------------------------------ البناء ------------------------------ */
/**
 * @param {ArrayBuffer|Uint8Array} template  ملف القالب
 * @param {{date:string, observations:any[]}} report  الملاحظات المراد إدراجها (المعتمدة)
 * @param {{entity?:string, subject?:string, year?:string, from?:string, to?:string, letterNo?:string}} meta
 * @returns {Promise<Uint8Array>}
 */
export async function buildReportDocx(template, report, meta = {}) {
  const obs = [...(report.observations ?? [])].sort((a, b) => SEV_ORDER[a.risk.rating] - SEV_ORDER[b.risk.rating]);
  if (!obs.length) throw new Error("لا توجد ملاحظات لإدراجها في التقرير");

  const zip = await JSZip.loadAsync(template);
  const xml = await zip.file("word/document.xml").async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("تعذر قراءة قالب التقرير");
  const body = all(doc, "body")[0];
  const top = [...body.childNodes].filter((n) => n.nodeType === 1);
  const tables = top.filter((n) => n.localName === "tbl");

  /* --- نماذج جداول الملاحظات المفصلة (مرتفعة/متوسطة/منخفضة) --- */
  const detailProtos = {};
  const detailTables = tables.filter((t) => textOf(t).includes("رد إدارة الجهة") && textOf(t).includes("تعقيب الديوان"));
  if (detailTables.length < 1) throw new Error("القالب لا يحوي جدول الملاحظة المفصلة");
  for (const t of detailTables) {
    const sevCell = cells(rows(t)[1]).at(-1);
    const word = norm(textOf(sevCell));
    const key = Object.keys(SEV_WORD).find((k) => SEV_WORD[k] === word);
    if (key) detailProtos[key] = t;
  }
  const anyProto = detailProtos.high ?? detailProtos.medium ?? detailProtos.low;
  const protoFor = (sev) => detailProtos[sev] ?? anyProto;
  const firstDetail = detailTables[0];
  // نخزن النماذج ثم نحذف الجداول والفقرات الفارغة بينها
  const protoClones = Object.fromEntries(Object.entries(detailProtos).map(([k, v]) => [k, v.cloneNode(true)]));
  const lastDetail = detailTables.at(-1);
  let cursor = firstDetail;
  const toRemove = [];
  while (cursor) {
    toRemove.push(cursor);
    if (cursor === lastDetail) break;
    cursor = cursor.nextSibling;
  }
  const insertBefore = lastDetail.nextSibling;
  toRemove.forEach((n) => n.parentNode.removeChild(n));

  const bookmarkName = (i) => `_RasdObs${i + 1}`;
  let bmId = 9000;
  obs.forEach((o, i) => {
    const proto = protoClones[o.risk.rating] ?? Object.values(protoClones)[0];
    const t = proto.cloneNode(true);
    all(t, "bookmarkStart").forEach((b) => b.parentNode.removeChild(b));
    all(t, "bookmarkEnd").forEach((b) => b.parentNode.removeChild(b));
    const trs = rows(t);

    // عنوان الملاحظة (الخلية الأولى في الصف الثاني، ترقيمها آلي من القالب) + إشارة مرجعية لرقم الصفحة
    const titleCell = cells(trs[1])[0];
    const tp = kids(titleCell, "p")[0];
    tp.appendChild(el(doc, "bookmarkStart", { id: String(++bmId), name: bookmarkName(i) }));
    tp.appendChild(run(doc, o.test, { bold: true, size: 24 }));
    tp.appendChild(el(doc, "bookmarkEnd", { id: String(bmId) }));

    // متن الملاحظة: الحالة · السند القانوني · السبب · الأثر
    const basis = o.legalBasis?.needsVerification ? `${o.legalBasis.text} (يُستكمل رقم المادة من النظام المعتمد)` : o.legalBasis?.text ?? "";
    const items = [
      ["الحالة", o.condition],
      ["السند القانوني", basis],
      ["السبب", o.cause],
      ["الأثر", o.effect],
    ];
    const bodyCell = cells(trs[2])[0];
    setCellParas(
      bodyCell,
      items.map(([label, text]) => para(doc, [run(doc, `${label}: `, { bold: true }), run(doc, String(text ?? ""))])),
    );

    // التوصيات: الصف الذي يلي رأس «التوصيات»
    const recIdx = trs.findIndex((r) => norm(textOf(r)) === "التوصيات");
    if (recIdx >= 0 && trs[recIdx + 1]) setCellParas(cells(trs[recIdx + 1])[0], [para(doc, [run(doc, String(o.recommendation ?? ""))])]);

    body.insertBefore(t, insertBefore);
    const gap = el(doc, "p");
    body.insertBefore(gap, insertBefore);
    body.insertBefore(el(doc, "p"), insertBefore);
  });

  /* --- جدول قائمة الملاحظات --- */
  const summary = tables.find((t) => textOf(t).includes("عنوان الملاحظة") && textOf(t).includes("رقم الصفحة"));
  if (summary) {
    const srows = rows(summary);
    const sample = srows.slice(2);
    const sevProto = {};
    for (const r of sample) {
      const w = norm(textOf(cells(r)[2]));
      const k = Object.keys(SEV_WORD).find((x) => SEV_WORD[x] === w);
      if (k && !sevProto[k]) sevProto[k] = r.cloneNode(true);
    }
    sample.forEach((r) => summary.removeChild(r));
    obs.forEach((o, i) => {
      const proto = sevProto[o.risk.rating] ?? Object.values(sevProto)[0];
      if (!proto) return;
      const r = proto.cloneNode(true);
      const c = cells(r);
      const numT = all(c[0], "t");
      if (numT[0]) numT[0].textContent = String(i + 1);
      numT.slice(1).forEach((t) => (t.textContent = ""));
      fillCell(doc, c[1], o.test);
      // «تاريخ التنفيذ» يحدده الطرف المسؤول عن الخطة فيبقى فارغاً (ما عدا «يتقرر لاحقا» التي في نموذج المنخفضة)
      if (c[4]) {
        const p = kids(c[4], "p")[0];
        all(p, "t").forEach((t) => (t.textContent = ""));
        fieldRuns(doc, `PAGEREF ${bookmarkName(i)} \\h`, "—").forEach((x) => p.appendChild(x));
      }
      summary.appendChild(r);
    });
  }

  /* --- الاستنتاج العام: يُبقى المستوى المنطبق ويُحذف الباقي + فقرات التعليمات --- */
  const level = conclusionLevel(obs);
  const paras = all(body, "p").filter((p) => p.parentNode === body);
  const tag = (p) => {
    const t = norm(textOf(p));
    if (/^\(?هذه الفقرة مناسبة في حال وجود عدد 3/.test(t) || /^\(هذه الفقرة مناسبة في حال وجود عدد 3/.test(t)) return "drop";
    if (t.startsWith("بناء على نتائج عمليات التدقيق") && /تم تصميمها بشكل كاف وتعمل/.test(t)) return 1;
    if (t.startsWith("حيث يوجد بعض القصور الطفيف")) return 1;
    if (t.startsWith("بناء على نتائج عمليات التدقيق") && /في حاجة إلى التحسين/.test(t)) return 2;
    if (t.startsWith("حيث يوجد العديد من الملاحظات المرتفعة والمتوسطة")) return 2;
    if (t.startsWith("بناء على نتائج عمليات التدقيق") && /لم يتم تصميمها بشكل كاف/.test(t)) return 3;
    if (t.startsWith("تمثل الملاحظات المرتفعة في تقريرنا")) return 3;
    return 0;
  };
  for (const p of paras) {
    const k = tag(p);
    if (k === "drop" || (k && k !== level)) p.parentNode.removeChild(p);
    else if (k) replaceInPara(p, (s) => s.replace(/\s*\(هذه الفقرة[^)]*\)/g, "").trimEnd());
  }

  /* --- بيانات الغلاف والمقدمة (فقط ما أدخله المدقق) --- */
  const entity = norm(meta.entity);
  const subject = norm(meta.subject);
  const year = norm(meta.year) || String(report.date ?? "").slice(0, 4);
  for (const p of all(body, "p")) {
    replaceInPara(p, (s) => {
      let out = s;
      if (/اسم الجهة \/ تقرير تدقيق/.test(out)) {
        if (entity) out = out.replace("اسم الجهة", entity);
        if (subject) out = out.replace("موضوع التقرير", subject);
      }
      if (year) out = out.replace(/\(20[xX]{2}\)/g, `(${year})`);
      if (/xx\/xx\/xxxx/i.test(out)) {
        if (meta.from) out = out.replace(/xx\/xx\/xxxx/i, meta.from);
        if (meta.to) out = out.replace(/xx\/xx\/xxxx/i, meta.to);
      }
      if (entity) out = out.replace(/الجه[ـ]*ة X/g, `الجهة ${entity}`).replace(/\(اسم الجهة\)/g, entity);
      if (entity || subject) out = out.replace(/\(ذكر موضوع التدقيق واسم الجهة\)/g, [subject, entity && `لدى ${entity}`].filter(Boolean).join(" "));
      if (meta.letterNo) out = out.replace(/\(إدراج كتاب التكليف[^)]*\)/, `(${meta.letterNo})`);
      return out;
    });
  }

  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));

  /* --- تحديث الحقول (جدول المحتويات وأرقام الصفحات) عند فتح الملف في Word --- */
  const sf = zip.file("word/settings.xml");
  if (sf) {
    let s = await sf.async("string");
    if (!/<w:updateFields/.test(s)) {
      const m = s.match(/<w:(hdrShapeDefaults|footnotePr|endnotePr|compat|docVars|rsids)\b/);
      const tagStr = '<w:updateFields w:val="true"/>';
      s = m ? s.replace(m[0], tagStr + m[0]) : s.replace("</w:settings>", tagStr + "</w:settings>");
      zip.file("word/settings.xml", s);
    }
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function fetchTemplate(url = TEMPLATE_URL) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("تعذر تحميل قالب التقرير");
  return res.arrayBuffer();
}

export const REPORT_META_KEY = "rasd-report-meta";
export function loadReportMeta() {
  try {
    const v = JSON.parse(localStorage.getItem(REPORT_META_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
export function saveReportMeta(m) {
  try {
    localStorage.setItem(REPORT_META_KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable */
  }
}
