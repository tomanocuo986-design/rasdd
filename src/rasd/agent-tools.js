// أدوات «وكيل رصد»: تُنفَّذ في المتصفح لأن بيانات المدقق محفوظة فيه ولا تغادره إلا كملخص.
// تعريفاتها (الأسماء والمعاملات) على الخادم في src/server/agent.ts؛ هنا التنفيذ فقط.
// كل الاعتماديات تُحقن (deps) كي تُختبر الأدوات دون واجهة ولا localStorage.
//
// القاعدة الأمنية: الأدوات القارئة حرة، والكاتبة (record_review_decision) لا تُنفَّذ هنا إلا بعد موافقة
// يمنحها المدقق في الواجهة (انظر agent-loop.js)، ولا توجد أداة تعتمد ملاحظة أو تتجاوز بوابة السند القانوني.

import { DECISIONS, observationFingerprint, decisionFor, recordDecision, ruleStats } from "./review-log.js";

const MAX_RESULT_CHARS = 7000;
const clip = (s, n) => {
  const t = String(s ?? "");
  return t.length > n ? t.slice(0, n) + "…" : t;
};
const SEV_RANK = { high: 0, medium: 1, low: 2 };

/** يحوّل نتيجة أداة إلى نص بحد أقصى للحجم (نتائج الأدوات تُرسل للنموذج وتُحسب ضمن حدود الطلب). */
export function stringifyResult(value, max = MAX_RESULT_CHARS) {
  let s;
  try {
    s = JSON.stringify(value);
  } catch {
    s = JSON.stringify({ error: "نتيجة غير قابلة للتسلسل" });
  }
  return s.length > max ? JSON.stringify({ truncated: true, partial: s.slice(0, max - 60) }) : s;
}

/**
 * @param {object} deps
 * @param {() => object} deps.getStore            بيانات التدقيق المحفوظة
 * @param {(store:object) => any[]} deps.runAudit  يُرجع الملاحظات الخام
 * @param {(findings:any[], store:object) => any[]} deps.group  يجمّعها إلى «ملاحظات» (draftObservations)
 * @param {(store:object, findings:any[]) => any} deps.summarize ملخص التدقيق (summarizeAudit)
 * @param {(key:string) => string} deps.sectorLabel
 * @param {() => Promise<any[]>} deps.listDocs    وثائق مكتبة الأنظمة
 * @param {(docs:any[], q:string, opts:object) => any[]} deps.retrieve
 * @param {(passages:any[]) => any[]} deps.toPayload
 * @param {() => any[]} deps.loadLog / deps.saveLog
 * @param {() => Set<string>} deps.loadDeleted / deps.saveDeleted
 * @param {(o:any) => string} deps.basisOf         حالة السند (library|framework|none)
 * @param {(event:string, target:string, detail:string) => void} deps.track
 */
export function createToolbox(deps) {
  let snap = null; // { findings, groups } — يُحدَّث عند rerun_audit
  const fresh = () => {
    const store = deps.getStore() ?? {};
    const findings = deps.runAudit(store);
    const deleted = deps.loadDeleted();
    const all = deps.group(findings, store).sort(
      (a, b) => (SEV_RANK[a.risk?.rating] ?? 3) - (SEV_RANK[b.risk?.rating] ?? 3) || (b.risk?.score ?? 0) - (a.risk?.score ?? 0) || b.count - a.count,
    );
    const visible = all.filter((g) => !deleted.has(g.id));
    snap = { store, findings, hidden: all.length - visible.length, groups: visible.map((g, i) => ({ ...g, fid: `F${i + 1}` })) };
    return snap;
  };
  const get = () => snap ?? fresh();
  const byFid = (id) => get().groups.find((g) => g.fid === String(id ?? "").trim().toUpperCase());

  const row = (g) => ({
    id: g.fid,
    sector: deps.sectorLabel(g.sector),
    test: g.test,
    count: g.count,
    severity: g.risk?.rating,
    score: g.risk?.score,
    refs: g.refs,
    repeated: g.repeated || undefined,
    legal_basis: deps.basisOf(g),
    condition: clip(g.condition, 220),
  });

  const tools = {
    get_overview() {
      const s = get();
      const summary = deps.summarize(s.store, s.findings);
      if (!summary) return { empty: true, message: "لا توجد بيانات مدخلة أو مستوردة بعد." };
      const rest = { ...summary };
      delete rest.topFindings; // القائمة الكاملة عبر list_findings
      return { ...rest, observation_groups: s.groups.length, hidden_by_auditor: s.hidden };
    },

    list_findings({ severity, sector, test, repeated_only, limit } = {}) {
      const s = get();
      const sec = String(sector ?? "").trim();
      const tst = String(test ?? "").trim();
      let list = s.groups.filter(
        (g) =>
          (!severity || g.risk?.rating === severity) &&
          (!sec || deps.sectorLabel(g.sector).includes(sec)) &&
          (!tst || String(g.test).includes(tst)) &&
          (!repeated_only || g.repeated > 0),
      );
      const total = list.length;
      const n = Math.min(Math.max(Number.parseInt(limit, 10) || 15, 1), 40);
      list = list.slice(0, n);
      return { total_matching: total, returned: list.length, findings: list.map(row) };
    },

    get_finding({ id } = {}) {
      const g = byFid(id);
      if (!g) return { error: `لا توجد ملاحظة بالمعرّف ${id}. استخدم list_findings.` };
      const d = decisionFor(deps.loadLog(), g);
      const samples = get()
        .findings.filter((f) => f.dataset === g.dataset && String(f.test).trim() === String(g.test).trim())
        .slice(0, 6)
        .map((f) => ({ ref: f.ref, row: f.row, detail: clip(f.detail, 200), impact: f.impact }));
      return {
        ...row(g),
        condition: clip(g.condition, 700),
        cause: g.cause,
        effect: g.effect,
        recommendation: g.recommendation,
        legal_basis_text: clip(g.legalBasis?.text, 500),
        repeated_from_past_reports: g.repeated,
        previous_decision: d ? { decision: d.decision, note: d.note, at: d.at } : undefined,
        samples,
      };
    },

    async search_legal({ query, k } = {}) {
      const q = String(query ?? "").trim();
      if (!q) return { error: "اكتب موضوع البحث." };
      const docs = await deps.listDocs();
      if (!docs?.length) return { passages: [], message: "مكتبة الأنظمة فارغة؛ ارفع الأنظمة أولًا. لا تستشهد بأي مادة." };
      const n = Math.min(Math.max(Number.parseInt(k, 10) || 4, 1), 8);
      const passages = deps.toPayload(deps.retrieve(docs, q, { k: n }), { maxItems: n, maxChars: 700 });
      return passages.length
        ? { passages }
        : { passages: [], message: "لا يوجد سند كافٍ في مكتبة الأنظمة المرفوعة لهذا الموضوع." };
    },

    get_review_stats() {
      const stats = ruleStats(deps.loadLog()).slice(0, 15);
      return stats.length
        ? { rules: stats.map((s) => ({ ...s, falsePositiveRate: Math.round(s.falsePositiveRate * 100) / 100 })) }
        : { rules: [], message: "لا توجد قرارات مراجعة مسجلة بعد." };
    },

    rerun_audit() {
      const s = fresh();
      return { findings_total: s.findings.length, observation_groups: s.groups.length, hidden_by_auditor: s.hidden, note: "تغيّرت المعرّفات F#؛ أعد list_findings." };
    },

    record_review_decision({ id, decision, note } = {}) {
      const g = byFid(id);
      if (!g) return { error: `لا توجد ملاحظة بالمعرّف ${id}.` };
      if (decision !== DECISIONS.confirmed && decision !== DECISIONS.falsePositive)
        return { error: "القرار يجب أن يكون confirmed أو false_positive." };
      const fp = decision === DECISIONS.falsePositive;
      const text = clip(note, 300) || "";
      deps.saveLog(
        recordDecision(deps.loadLog(), {
          dataset: g.dataset,
          test: g.test,
          ref: g.id,
          decision,
          note: text ? `[عبر الوكيل] ${text}` : "[عبر الوكيل]",
          fingerprint: observationFingerprint(g),
          autoHidden: fp,
        }),
      );
      if (fp) deps.saveDeleted(new Set(deps.loadDeleted()).add(g.id));
      deps.track(fp ? "ui.finding.false_positive" : "ui.finding.confirm", g.id, `${g.dataset}|${g.test} (agent)`);
      snap = null; // الملاحظات المخفية تغيّرت
      return { ok: true, recorded: decision, finding: `${g.fid} ${g.test}`, hidden_from_list: fp };
    },
  };

  /** يصف الإجراء بجملة عربية يقرؤها المدقق قبل الموافقة. */
  const describe = (name, args) => {
    if (name !== "record_review_decision") return name;
    const g = byFid(args?.id);
    const word = args?.decision === DECISIONS.falsePositive ? "إنذار كاذب (يُخفي الملاحظة من القائمة)" : "مؤكدة";
    return `تسجيل قرار «${word}» على ${g ? `${g.fid}: ${g.test} (${deps.sectorLabel(g.sector)})` : String(args?.id ?? "")}` + (args?.note ? ` — السبب: ${clip(args.note, 120)}` : "");
  };

  async function run(name, args) {
    const fn = tools[name];
    if (!fn) return stringifyResult({ error: `أداة غير معروفة: ${name}` });
    try {
      return stringifyResult(await fn(args && typeof args === "object" ? args : {}));
    } catch (e) {
      return stringifyResult({ error: `فشلت الأداة: ${clip(e?.message, 160)}` });
    }
  }

  return { run, describe, names: Object.keys(tools), invalidate: () => (snap = null) };
}
