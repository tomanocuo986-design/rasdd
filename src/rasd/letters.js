// @ts-nocheck
/**
 * تصدير الملاحظات الرقابية على هيئة كتب رسمية منسقة، كتاب واحد لكل نشاط، بالسند القانوني والتفاصيل الميدانية.
 * المنطق هنا نقي (بلا DOM) ليسهل اختباره؛ التنزيل والطباعة في letters.jsx.
 */
export const DEFAULT_ADDRESSEE = {
  finance: "مدير الدائرة المالية",
  hr: "مدير دائرة الموارد البشرية",
  fleet: "مدير دائرة الآليات والورش",
  warehouses: "مدير دائرة المستودعات واللوازم",
  advances: "مدير الدائرة المالية",
  procurement: "رئيس لجنة المشتريات ومدير اللوازم",
  tenders: "رئيس لجنة العطاءات ومدير الدائرة الهندسية",
};

export const defaultLetterMeta = {
  country: "المملكة الأردنية الهاشمية",
  municipality: "",
  unit: "وحدة التدقيق الداخلي",
  signer: "",
  signerTitle: "مدير وحدة التدقيق الداخلي",
  copyTo: "رئيس البلدية / المدير التنفيذي",
  replyDays: 10,
  maxRecords: 10,
};

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const RISK = { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" };

const historyLine = (group) => {
  const st = (g) => g.history?.status;
  const recurring = group.filter((g) => st(g) === "recurring" || st(g) === "pattern");
  if (!recurring.length) return "ملاحظة جديدة لم ترد في تقارير التدقيق السابقة.";
  const reports = [...new Set(recurring.flatMap((g) => (g.history?.reports ?? []).map((r) => r.name)))].slice(0, 3);
  const prev = recurring.find((g) => g.history?.previousRecommendation)?.history.previousRecommendation;
  const base = `ملاحظة متكررة (${recurring.length} من ${group.length} حالة) وردت سابقاً في: ${reports.join("، ")}.`;
  return prev ? `${base} التوصية السابقة: «${prev.text}» — ولم يثبت تنفيذها.` : base;
};

/**
 * @param observations  ملاحظات draftObservations (بعد قرارات الحذف والاعتماد)
 * @param findings      الملاحظات الخام الحالية (للتفاصيل الميدانية والتاريخ)
 * @param sectors       auditSectors
 * @param meta          بيانات الكتاب
 * @param opts          { approvedOnly, datasetLabel, date }
 */
export function buildLetters(observations, findings, sectors, meta = {}, opts = {}) {
  const m = { ...defaultLetterMeta, ...meta };
  const label = opts.datasetLabel ?? ((k) => k);
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const letters = [];
  for (const s of sectors) {
    const obs = observations.filter((o) => o.sector === s.key && (!opts.approvedOnly || o.status === "approved"));
    if (!obs.length) continue;
    const items = obs.map((o, i) => {
      const group = findings.filter((f) => f.dataset === o.dataset && f.test.trim() === o.test.trim());
      return {
        no: i + 1,
        test: o.test,
        risk: RISK[o.risk.rating],
        riskKey: o.risk.rating,
        approved: o.status === "approved",
        condition: o.condition,
        history: historyLine(group),
        legal: o.legalBasis.needsVerification ? `${o.legalBasis.text} (يُستكمل رقم المادة من النسخة المعتمدة)` : o.legalBasis.text,
        legalSource: o.legalBasis.source,
        cause: o.cause,
        effect: o.effect,
        recommendation: o.recommendation,
        dataset: label(o.dataset),
        records: group.slice(0, m.maxRecords).map((g) => ({ no: (g.row ?? 0) + 1, ref: g.ref || "—", detail: g.detail || "—" })),
        moreRecords: Math.max(0, group.length - m.maxRecords),
        amount: group.reduce((a, g) => a + (Number(g.impact) || 0), 0),
      };
    });
    const high = items.filter((x) => x.riskKey === "high").length;
    letters.push({
      sector: s.key,
      sectorLabel: s.label,
      meta: m,
      date,
      to: m.addressees?.[s.key] ?? DEFAULT_ADDRESSEE[s.key] ?? "المدير المعني",
      subject: `ملاحظات رقابية على ${s.label}`,
      items,
      high,
      draft: items.some((x) => !x.approved),
    });
  }
  return letters;
}

const block = (title, text) => (text ? `<p class="f"><b>${esc(title)}:</b> ${esc(text)}</p>` : "");

export function letterHtml(l, index = 0, total = 1) {
  const m = l.meta;
  const items = l.items
    .map(
      (it) => `
  <section class="obs">
    <h3>${it.no}. ${esc(it.test)} <span class="risk r-${it.riskKey}">مخاطر ${esc(it.risk)}</span>${it.approved ? "" : '<span class="draft">مسودة</span>'}</h3>
    ${block("الحالة", it.condition)}
    ${block("المقارنة بالتقارير السابقة", it.history)}
    ${block("السند القانوني", it.legal)}
    ${block("السبب الجذري", it.cause)}
    ${block("الأثر", it.effect)}
    ${it.amount ? block("الأثر المالي المقدّر", `${Number(it.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })} دينار`) : ""}
    ${block("التوصية", it.recommendation)}
    <table>
      <caption>التفاصيل الميدانية — ${esc(it.dataset)}</caption>
      <thead><tr><th>رقم السجل</th><th>المعرّف</th><th>التفاصيل</th></tr></thead>
      <tbody>${it.records.map((r) => `<tr><td>${esc(r.no)}</td><td>${esc(r.ref)}</td><td>${esc(r.detail)}</td></tr>`).join("")}</tbody>
    </table>
    ${it.moreRecords ? `<p class="more">… و${it.moreRecords} سجل آخر مرفق تفصيله في ملف نتائج التدقيق.</p>` : ""}
  </section>`,
    )
    .join("");
  return `
<article class="letter"${index < total - 1 ? ' style="page-break-after:always"' : ""}>
  <header>
    <div class="hd-r"><div>${esc(m.country)}</div><div><b>${esc(m.municipality || "………… البلدية")}</b></div><div>${esc(m.unit)}</div></div>
    <div class="hd-l"><div>الرقم: ${esc(m.refPrefix ?? "")}${esc(m.refNo ? `${m.refNo}/${index + 1}` : "………")}</div><div>التاريخ: ${esc(l.date)}</div></div>
  </header>
  <p class="to"><b>السيد ${esc(l.to)} المحترم</b></p>
  <p class="subj"><b>الموضوع: ${esc(l.subject)}</b></p>
  <p>تحية طيبة وبعد،</p>
  <p>بنتيجة أعمال التدقيق على «${esc(l.sectorLabel)}» رصدنا ${l.items.length} ملاحظة رقابية${l.high ? ` منها ${l.high} مرتفعة المخاطر` : ""}، نوردها فيما يلي بسندها القانوني وتفاصيلها الميدانية، آملين دراستها وتزويدنا بردكم وبإجراءات التصويب المتخذة خلال ${esc(m.replyDays)} أيام عمل من تاريخ هذا الكتاب.</p>
  ${items}
  <p>وتفضلوا بقبول فائق الاحترام والتقدير،،،</p>
  <div class="sig"><div>${esc(m.signer || "………………")}</div><div>${esc(m.signerTitle)}</div></div>
  <p class="cc">نسخة إلى: ${esc(m.copyTo)}</p>
  ${l.draft ? '<p class="foot">الحالة: مسودة تتضمن ملاحظات غير معتمدة بعد من المدقق — لا تُرسل قبل الاعتماد.</p>' : '<p class="foot">جميع الملاحظات الواردة معتمدة من المدقق.</p>'}
</article>`;
}

export function lettersDocument(letters, title = "كتب رقابية") {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Amiri","Traditional Arabic","Times New Roman",serif; font-size: 13pt; line-height: 1.7; color: #111; }
  header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; font-size: 12pt; }
  .hd-l { text-align: left; }
  .to, .subj { margin: 8px 0; }
  .obs { margin: 14px 0; padding: 10px 12px; border: 1px solid #999; border-radius: 4px; page-break-inside: avoid; }
  .obs h3 { font-size: 13.5pt; margin: 0 0 6px; }
  .f { margin: 3px 0; }
  .risk { font-size: 10.5pt; padding: 1px 8px; border-radius: 10px; color: #fff; margin-inline-start: 8px; }
  .r-high { background: #dc2626; } .r-medium { background: #ea580c; } .r-low { background: #16a34a; }
  .draft { font-size: 10pt; border: 1px dashed #666; padding: 0 6px; margin-inline-start: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11pt; }
  caption { text-align: right; font-weight: bold; padding: 4px 0; }
  th, td { border: 1px solid #555; padding: 3px 6px; text-align: right; vertical-align: top; }
  th { background: #eee; }
  .more, .cc, .foot { font-size: 11pt; color: #333; }
  .sig { margin-top: 28px; text-align: left; padding-inline-start: 55%; }
  .sig div:first-child { font-weight: bold; margin-bottom: 2px; }
  .foot { border-top: 1px solid #aaa; margin-top: 12px; padding-top: 6px; }
</style></head>
<body>${letters.map((l, i) => letterHtml(l, i, letters.length)).join("\n")}</body></html>`;
}
