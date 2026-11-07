// @ts-nocheck
/* eslint-disable */
import * as import_react from "react";
import { loadLinks, linkedRegulation, saveLinks } from "./legal-status";
import { auditSectors, defaultParams, runAudit, allDatasets } from "./audit-engine.js";
import { defaultCalibration, loadCalibration, saveCalibration, impactAmount, calibrateSeverity } from "./severity";
import { listRegulations, saveRegulation, deleteRegulation, updateRegulationMeta } from "./regulations-db";
import { startOfficialSync, syncSummary, isOfficialDoc } from "./official-library";
import { extractPdfPages, extractPdfText } from "./pdf-text";
import { DEMO_FLAG_KEY, DEMO_SNAPSHOT_KEY } from "./demo-data.js";
import { buildHistoryIndex, classifyFindings, resolvedFindings, historySummary, STATUS_LABEL } from "./history";
import { valueKeyOf, complianceOf, AdvancedPanel } from "./advanced";
import { legalFrameworkOf, legalTextOf } from "./legal-framework";
import { publishAssistantContext, summarizeAudit } from "./assistant-context.js";
import { loadIds, loadEdits, draftObservations, applyEdits, applyEdit, saveIds, saveDraft, diffEdit, saveEdits } from "./observations";
import { loadReviewLog, loadThreshold, decisionFor, staleHiddenIds, saveReviewLog, recordDecision, observationFingerprint, saveThreshold } from "./review-log.js";
import { useManualObservations } from "./manual-observations";
import { trackEvent } from "./audit-trail.js";
import { mergeSeedReports, markSeedRemoved } from "./seed-reports.js";
import { missingRequired, partitionRecords, rejectionMessage, rejectedToCsv } from "./validation";
import { Save, Download, FileDown, Upload, Trash2, Plus, BookOpen, FileText, History, SlidersHorizontal, ShieldAlert } from "lucide-react";
import { mapSheets, mapWorkbook } from "./import-table";
import { jsonToSheets, xmlToSheets, rowsFromAoaChunked } from "./import-formats.js";
import { extractPdfRows } from "./pdf-rows";
import * as import_jsx_runtime from "react/jsx-runtime";
import { RejectedAlert, CalibrationPanel } from "./panels";
import { DemoBar } from "./DemoBar.jsx";
import { LegalUrlImport } from "./LegalUrlImport";
import { LibraryMeta } from "./LibraryMeta";
import BackupPanel from "./BackupPanel";
import { ObservationsPanel } from "./ObservationsPanel";
import { LegalCoveragePanel } from "./LegalCoveragePanel";
import { DocReviewPanel } from "./DocReviewPanel";
import { ReviewStatsPanel } from "./ReviewStatsPanel";
import { ExecutiveDashboard } from "./dashboard";
import { buildDemoBundle, datasetLabel, findingKey, import_papaparse, loadReports, order, paramFields, riskLevel, sectorLabel, sevClass, sevLabel, storeReports } from "./audit-support.js";
import { matchRegulation, segmentDoc } from "./regulation-match.js";

const CONFIDENCE_LABEL = { high: "عالية", medium: "متوسطة", low: "منخفضة" };
import { downloadReportPdf, parseReportText } from "./report-export.jsx";
import { Button } from "./ui-primitives.jsx";

export function SectorAudit({ auditTab }) {
  const [store, setStore] = (0, import_react.useState)({});
  const [reports, setReports] = (0, import_react.useState)([]);
  const [docs, setDocs] = (0, import_react.useState)([]);
  const [officialMsg, setOfficialMsg] = (0, import_react.useState)("");
  const [legalLinks, setLegalLinks] = (0, import_react.useState)(() => loadLinks());
  const [loaded, setLoaded] = (0, import_react.useState)(false);
  const [sectorKey, setSectorKey] = (0, import_react.useState)(
    auditSectors[0].key,
  );
  const sector = auditSectors.find((s) => s.key === sectorKey);
  const [dsKey, setDsKey] = (0, import_react.useState)(sector.datasets[0].key);
  const ds = sector.datasets.find((d) => d.key === dsKey) ?? sector.datasets[0];
  const [draft, setDraft] = (0, import_react.useState)({});
  const [msg, setMsg] = (0, import_react.useState)("");
  const [importMsg, setImportMsg] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [params, setParams] = (0, import_react.useState)(defaultParams);
  const [calibration, setCalibration] = (0, import_react.useState)(defaultCalibration);
  const [alertMsg, setAlertMsg] = (0, import_react.useState)("");
  const [rejectedLog, setRejectedLog] = (0, import_react.useState)(null);
  const [demoActive, setDemoActive] = (0, import_react.useState)(false);
  const [hasDemoSnapshot, setHasDemoSnapshot] = (0, import_react.useState)(false);
  const [level, setLevel] = (0, import_react.useState)("all");
  const [sel, setSel] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const fileRef = (0, import_react.useRef)(null),
    pdfRef = (0, import_react.useRef)(null),
    reportRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    try {
      const v = JSON.parse(localStorage.getItem("rasd-audit-store") ?? "null");
      if (v && typeof v === "object") setStore(v);
    } catch {
      setStore({});
    }
    try {
      const v = JSON.parse(localStorage.getItem("rasd-audit-params") ?? "null");
      if (v && typeof v === "object")
        setParams({
          ...defaultParams,
          ...v,
        });
    } catch {
      setParams(defaultParams);
    }
    setCalibration(loadCalibration());
    setReports(loadReports());
    listRegulations()
      .then(setDocs)
      .catch(() => {});
    const refreshDocs = () => listRegulations().then(setDocs).catch(() => {});
    const officialSync = startOfficialSync({
      fetchImpl: (u, i) => fetch(u, i),
      listRegulations,
      saveRegulation,
      deleteRegulation,
      extractPdfPages,
      onProgress: setOfficialMsg,
      onChange: refreshDocs,
    });
    officialSync.done
      .then((r) => {
        setOfficialMsg(syncSummary(r));
        refreshDocs();
      })
      .catch(() => setOfficialMsg(""));
    try {
      setDemoActive(localStorage.getItem(DEMO_FLAG_KEY) === "1");
      setHasDemoSnapshot(!!localStorage.getItem(DEMO_SNAPSHOT_KEY));
    } catch {
      /* storage unavailable */
    }
    setLoaded(true);
    return () => officialSync.stop();
  }, []);
  (0, import_react.useEffect)(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("rasd-audit-store", JSON.stringify(store));
    } catch {
      setAlertMsg(
        "تعذر حفظ البيانات في المتصفح (امتلأت المساحة). نزّل نسخة احتياطية من تبويب «التقارير السابقة» الآن.",
      );
    }
  }, [store, loaded]);
  (0, import_react.useEffect)(() => {
    if (!loaded) return;
    // كان setItem هنا بلا try/catch: امتلاء التخزين أو تعطيله (وضع التصفح الخاص) كان يرمي خطأ داخل useEffect فتنهار الشاشة.
    try {
      localStorage.setItem("rasd-audit-params", JSON.stringify(params));
    } catch {
      setAlertMsg(
        "تعذر حفظ إعدادات التدقيق في المتصفح (امتلأت المساحة أو التخزين معطّل). نزّل نسخة احتياطية الآن.",
      );
    }
  }, [params, loaded]);
  (0, import_react.useEffect)(() => {
    if (loaded && !storeReports(reports))
      setAlertMsg(
        "تعذر حفظ التقارير في المتصفح (امتلأت المساحة). نزّل نسخة احتياطية من تبويب «التقارير السابقة» الآن.",
      );
  }, [reports, loaded]);
  (0, import_react.useEffect)(() => {
    if (loaded) saveCalibration(calibration);
  }, [calibration, loaded]);
  const segmented = (0, import_react.useMemo)(
    () =>
      docs.map((d) => ({
        id: d.id,
        name: d.name,
        segments: segmentDoc(d.text),
      })),
    [docs],
  );
  const historyIndex = (0, import_react.useMemo)(
    () => buildHistoryIndex(reports),
    [reports],
  );
  const findings = (0, import_react.useMemo)(() => {
    const lastName = historyIndex.last?.name ?? "";
    const base = runAudit(store, Date.now(), params).map((f) => {
      const d = auditSectors
        .flatMap((s) => s.datasets)
        .find((x) => x.key === f.dataset);
      const row = store[f.dataset]?.[f.row] ?? {};
      const ref = d ? (row[d.fields[0].key] ?? "") : "";
      return {
        ...f,
        ref,
        key: findingKey(f.dataset, f.test, ref),
        impact: impactAmount(f, row, d ? valueKeyOf(d) : void 0),
        regulation:
          linkedRegulation(legalLinks, f.dataset, f.test) ??
          matchRegulation(f.test, segmented),
        legal: legalFrameworkOf(f),
      };
    });
    return classifyFindings(base, historyIndex)
      .map((f) => {
        const cal = calibrateSeverity(
          f.severity,
          {
            exactCount: f.history.exactCount,
            patternCount: f.history.patternCount,
            amount: f.impact,
          },
          calibration,
        );
        const st = f.history.status;
        return {
          ...f,
          calibration: cal,
          finalSeverity: cal.severity,
          repeat:
            st === "recurring"
              ? { report: f.history.reports.at(-1)?.name ?? lastName, exact: true }
              : st === "pattern"
                ? { report: f.history.reports.at(-1)?.name ?? lastName, exact: false }
                : void 0,
        };
      })
      .sort((a, b) => order[a.finalSeverity] - order[b.finalSeverity]);
  }, [store, historyIndex, segmented, params, calibration, legalLinks]);
  // ملخص بيانات التدقيق للمساعد الذكي (تحليل ودردشة)
  (0, import_react.useEffect)(() => {
    if (!loaded) return;
    publishAssistantContext(
      "audit",
      summarizeAudit(store, findings, allDatasets, sectorLabel),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findings, store, loaded]);
  const rows = store[ds.key] ?? [];
  const sectorFindings = (0, import_react.useMemo)(
    () => findings.filter((f) => f.sector === sectorKey),
    [findings, sectorKey],
  );
  const sectorStore = (0, import_react.useMemo)(
    () =>
      Object.fromEntries(
        sector.datasets.map((x) => [x.key, store[x.key] ?? []]),
      ),
    [store, sector],
  );
  const dsFindings = findings.filter((f) => f.dataset === ds.key);
  const historyResult = (0, import_react.useMemo)(() => {
    const active = new Set(
      Object.entries(store)
        .filter(([, rs]) => Array.isArray(rs) && rs.length)
        .map(([k]) => k),
    );
    return resolvedFindings(
      historyIndex,
      new Set(findings.map((f) => f.key)),
      active,
    );
  }, [historyIndex, findings, store]);
  const resolved = historyResult.resolved;
  const historyStats = (0, import_react.useMemo)(
    () => historySummary(findings, resolved),
    [findings, resolved],
  );
  const repeated = sectorFindings.filter((f) => f.repeat).length;
  const [approvedObs, setApprovedObs] = (0, import_react.useState)(() => loadIds("approved"));
  const [deletedObs, setDeletedObs] = (0, import_react.useState)(() => loadIds("deleted"));
  // تعديلات المدقق على صياغة الملاحظات المصاغة آلياً (تبقى بعد إعادة التحليل لأنها مفتاحها معرّف الملاحظة)
  const [obsEdits, setObsEdits] = (0, import_react.useState)(() => loadEdits());
  const [reviewLog, setReviewLog] = (0, import_react.useState)(() => loadReviewLog());
  (0, import_react.useEffect)(() => {
    // وكيل المساعد قد يسجّل قرارًا خارج هذه الحالة؛ نعيد القراءة من التخزين عند إشعاره
    const reload = () => {
      setReviewLog(loadReviewLog());
      setDeletedObs(loadIds("deleted"));
    };
    window.addEventListener("rasd-agent-write", reload);
    return () => window.removeEventListener("rasd-agent-write", reload);
  }, []);
  const [reviewThreshold, setReviewThreshold] = (0, import_react.useState)(() => loadThreshold());
  const rawObservations = (0, import_react.useMemo)(
    () =>
      auditSectors.flatMap((s) =>
        draftObservations(
          findings.filter((f) => f.sector === s.key),
          {
            datasetLabel,
            totalRecords: s.datasets.reduce(
              (a, x) => a + (store[x.key]?.length ?? 0),
              0,
            ),
            approved: approvedObs,
          },
        ),
      ),
    [findings, store, approvedObs],
  );
  const allObservations = (0, import_react.useMemo)(
    () => applyEdits(rawObservations, obsEdits),
    [rawObservations, obsEdits],
  );
  // ملاحظات كتبها المدقق واعتمدها نهائيًا من المساعد («مسودة مدقق»): تُدمج مع ملاحظات المحرك
  const manualObs = useManualObservations();
  (0, import_react.useEffect)(() => {
    setApprovedObs(loadIds("approved"));
  }, [manualObs]);
  const sectorObservations = (0, import_react.useMemo)(
    () =>
      [
        ...allObservations.filter((o) => o.sector === sectorKey),
        ...manualObs
          .filter((o) => o.sector === sectorKey)
          .map((o) => applyEdit({ ...o, status: approvedObs.has(o.id) ? "approved" : "draft" }, obsEdits[o.id])),
      ].sort((a, b) => b.risk.score - a.risk.score || b.count - a.count),
    [allObservations, sectorKey, manualObs, approvedObs],
  );
  const observations = (0, import_react.useMemo)(
    () => sectorObservations.filter((o) => !deletedObs.has(o.id)),
    [sectorObservations, deletedObs],
  );
  const deletedCount = sectorObservations.length - observations.length;
  const obsDecisions = (0, import_react.useMemo)(
    () =>
      Object.fromEntries(
        sectorObservations.map((o) => [o.id, decisionFor(reviewLog, o)]).filter(([, d]) => d),
      ),
    [sectorObservations, reviewLog],
  );
  // إنذار كاذب أُخفي سابقًا ثم تغيّرت بيانات الملاحظة (سجلات جديدة): يُعاد إظهارها للمراجعة
  (0, import_react.useEffect)(() => {
    const ids = staleHiddenIds(reviewLog, sectorObservations).filter((id) => deletedObs.has(id));
    if (!ids.length) return;
    const n = new Set(deletedObs);
    ids.forEach((id) => n.delete(id));
    saveIds("deleted", n);
    setDeletedObs(n);
    let nl = reviewLog;
    for (const o of sectorObservations.filter((x) => ids.includes(x.id))) {
      const d = decisionFor(nl, o);
      if (d) nl = nl.map((e) => (e.id === d.id ? { ...e, autoHidden: false } : e));
    }
    saveReviewLog(nl);
    setReviewLog(nl);
  }, [reviewLog, sectorObservations]);
  const decideObservation = (o, decision, note = "") => {
    const isFp = decision === "false_positive";
    const nl = recordDecision(loadReviewLog(), {
      dataset: o.dataset,
      test: o.test,
      ref: o.id,
      decision,
      note,
      fingerprint: observationFingerprint(o),
      autoHidden: isFp,
    });
    saveReviewLog(nl);
    setReviewLog(nl);
    trackEvent(isFp ? "ui.finding.false_positive" : "ui.finding.confirm", o.id, `${o.dataset}|${o.test}`);
    if (isFp) {
      const n = new Set(loadIds("deleted")).add(o.id);
      saveIds("deleted", n);
      setDeletedObs(n);
    }
  };
  (0, import_react.useEffect)(() => {
    const comp = complianceOf(store, findings);
    if (comp.total > 0)
      saveDraft({
        date: new Date().toISOString().slice(0, 10),
        // الصياغة الأصلية دون تعديلات المدقق؛ تُطبَّق التعديلات عند الدمج كي لا تضيع المقارنة بالأصل
        observations: rawObservations,
        compliance: comp,
      });
  }, [rawObservations]);
  // تعديل المدقق لصياغة ملاحظة (الحالة/السند/السبب/الأثر/التوصية/التصنيف) مع خيار الاعتماد الفوري
  const editObservation = (o, patch, approve) => {
    // نقارن بالمسودة الأصلية (قبل أي تعديل سابق) كي لا يُخزَّن إلا ما يخالفها فعلاً
    const original = rawObservations.find((x) => x.id === o.id) ?? manualObs.find((x) => x.id === o.id) ?? o;
    const e = diffEdit(original, patch);
    const n = { ...obsEdits };
    if (e) n[o.id] = e;
    else delete n[o.id];
    saveEdits(n);
    setObsEdits(n);
    trackEvent("ui.finding.edit", o.id, `${o.dataset}|${o.test}`);
    if (approve && !approvedObs.has(o.id)) toggleApprove(o.id);
  };
  const toggleApprove = (id) => {
    const n = new Set(approvedObs);
    n.has(id) ? n.delete(id) : n.add(id);
    saveIds("approved", n);
    setApprovedObs(n);
  };
  const counts = {
    high: sectorFindings.filter((f) => f.finalSeverity === "high").length,
    medium: sectorFindings.filter((f) => f.finalSeverity === "medium").length,
    low: sectorFindings.filter((f) => f.finalSeverity === "low").length,
  };
  const visible =
    level === "all"
      ? sectorFindings
      : sectorFindings.filter((f) => f.finalSeverity === level);
  const linked = sectorFindings.filter((f) => f.regulation).length;
  function applyDemo() {
    const { store: demoStore, params: demoParams, base, report } = buildDemoBundle();
    setStore(demoStore);
    setParams(demoParams);
    setReports(mergeSeedReports([report]));
    try {
      localStorage.setItem(DEMO_FLAG_KEY, "1");
    } catch {
      /* the banner just won't survive a reload */
    }
    setDemoActive(true);
    setSectorKey(auditSectors[0].key);
    setDsKey(auditSectors[0].datasets[0].key);
    setDraft({});
    setLevel("all");
    setSel(/* @__PURE__ */ new Set());
    const records = Object.values(demoStore).reduce((a, r) => a + r.length, 0);
    const high = base.filter((f) => f.severity === "high").length;
    setMsg(`تم تحميل العرض التجريبي: ${records} سجلًا افتراضيًا كشف المحرك فيها ${base.length} ملاحظة (${high} مرتفعة الخطورة).`);
  }
  function loadDemo() {
    const hasData = Object.values(store).some((r) => Array.isArray(r) && r.length) || reports.some((r) => !r.seed);
    if (hasData && !demoActive) {
      if (!window.confirm("سيحلّ العرض التجريبي مكان بياناتك وتقاريرك الحالية مؤقتًا. تُحفظ بياناتك كما هي وتعود عند الضغط على «الخروج واستعادة بياناتي». متابعة؟")) return;
      try {
        localStorage.setItem(DEMO_SNAPSHOT_KEY, JSON.stringify({ store, reports, params }));
        setHasDemoSnapshot(true);
      } catch {
        setMsg("تعذّر حفظ بياناتك الحالية قبل العرض (المساحة ممتلئة). نزّل نسخة احتياطية من تبويب «التقارير السابقة» ثم أعد المحاولة.");
        return;
      }
    }
    applyDemo();
  }
  function exitDemo() {
    if (!window.confirm("سيُحذف العرض التجريبي وأي تقارير حفظتها أثناءه. متابعة؟")) return;
    let snap = null;
    try {
      snap = JSON.parse(localStorage.getItem(DEMO_SNAPSHOT_KEY) ?? "null");
    } catch {
      snap = null;
    }
    setStore(snap?.store ?? {});
    setReports(mergeSeedReports(snap?.reports ?? []));
    setParams({ ...defaultParams, ...(snap?.params ?? {}) });
    try {
      localStorage.removeItem(DEMO_SNAPSHOT_KEY);
      localStorage.removeItem(DEMO_FLAG_KEY);
    } catch {
      /* ignore */
    }
    setHasDemoSnapshot(false);
    setDemoActive(false);
    setMsg(snap ? "تمت استعادة بياناتك وتقاريرك كما كانت قبل العرض." : "تم الخروج من العرض التجريبي.");
  }
  function pickSector(k) {
    const s = auditSectors.find((x) => x.key === k);
    setSectorKey(k);
    setDsKey(s.datasets[0].key);
    setDraft({});
    setLevel("all");
    setSel(/* @__PURE__ */ new Set());
  }
  function deleteRows(idx) {
    if (!idx.size) return;
    setStore((p) => ({
      ...p,
      [ds.key]: (p[ds.key] ?? []).filter((_, j) => !idx.has(j)),
    }));
    setSel(/* @__PURE__ */ new Set());
  }
  function deleteAllRows() {
    if (!rows.length) return;
    if (!window.confirm(`حذف جميع سجلات «${ds.label}» (${rows.length} سجل)؟ لا يمكن التراجع.`))
      return;
    deleteRows(new Set(rows.map((_, j) => j)));
    setMsg(`تم حذف جميع سجلات ${ds.label}`);
  }
  function add(e) {
    e.preventDefault();
    if (!ds.fields.some((f) => draft[f.key]?.trim())) return;
    const missing = missingRequired(ds, draft);
    if (missing.length) {
      setAlertMsg(
        `تنبيه: رُفض السجل لنقص حقول جوهرية في «${ds.label}» — ${missing.join("، ")}. أكمل الحقول ثم احفظ.`,
      );
      return;
    }
    setAlertMsg("");
    setStore((p) => ({
      ...p,
      [ds.key]: [...(p[ds.key] ?? []), draft],
    }));
    setDraft({});
  }
  function saveCsv(name, csv) {
    const url = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3e4);
  }
  const findingRow = (f) => ({
    "النشاط / العملية": sectorLabel(f.sector),
    الجدول: datasetLabel(f.dataset),
    "رمز الجدول": f.dataset,
    المعرّف: f.ref,
    "رقم السجل": f.row + 1,
    الاختبار: f.test,
    التفاصيل: f.detail,
    "المخاطر الأساسية": sevLabel[f.severity],
    "المخاطر النهائية": sevLabel[f.finalSeverity],
    "المقارنة بالتقارير السابقة": f.repeat
      ? `${f.repeat.exact ? "متكررة" : "نمط متكرر"} — ${f.repeat.report}`
      : "جديدة",
    "المرجع النظامي": f.regulation
      ? `${f.regulation.doc}: ${f.regulation.excerpt}${f.regulation.confidence ? ` [اقتراح آلي — ثقة ${CONFIDENCE_LABEL[f.regulation.confidence]}]` : ""}`
      : "",
    "السند القانوني": legalTextOf(f),
    "الحالة التاريخية": f.history ? STATUS_LABEL[f.history.status] : "",
    "الأثر المالي": f.impact || "",
    "تفسير الخطورة النهائية": f.calibration?.explain ?? "",
  });
  async function exportExcel(only) {
    const X = await import("xlsx");
    const wb = X.utils.book_new();
    for (const s of auditSectors)
      for (const d of s.datasets) {
        if (only && d.key !== only) continue;
        const rs = store[d.key] ?? [];
        if (only || rs.length)
          X.utils.book_append_sheet(
            wb,
            X.utils.json_to_sheet(
              rs.map((r) =>
                Object.fromEntries(
                  d.fields.map((f) => [f.label, r[f.key] ?? ""]),
                ),
              ),
            ),
            d.key.slice(0, 31),
          );
      }
    if (!only && findings.length)
      X.utils.book_append_sheet(
        wb,
        X.utils.json_to_sheet(findings.map(findingRow)),
        "نتائج التدقيق",
      );
    if (!wb.SheetNames.length) {
      setMsg("لا توجد بيانات للتصدير");
      return;
    }
    X.writeFile(wb, only ? `${only}.xlsx` : "rasd-audit.xlsx");
  }
  async function importFile(file) {
    if (!file) return;
    setImportMsg("جارٍ قراءة الملف...");
    try {
      const addRows = (list) => {
        const rejectedAll = [];
        const accepted = list.map((it) => {
          const dset = allDatasets.find((x) => x.key === it.key);
          if (!dset) return it;
          const part = partitionRecords(dset, it.rows);
          if (part.rejected.length) rejectedAll.push({ ds: dset, rejected: part.rejected });
          return { ...it, rows: part.accepted };
        });
        setStore((p) => {
          const next = { ...p };
          for (const it of accepted)
            next[it.key] = [...(next[it.key] ?? []), ...it.rows];
          return next;
        });
        if (rejectedAll.length) {
          setRejectedLog(rejectedAll);
          setAlertMsg(
            rejectedAll
              .map((x) => rejectionMessage(x.ds, x.rejected))
              .join(" "),
          );
        } else {
          setRejectedLog(null);
          setAlertMsg("");
        }
      };
      if (/\.(xlsx?|json|xml)$/i.test(file.name)) {
        let mapped;
        if (/\.json$/i.test(file.name)) {
          mapped = mapSheets(jsonToSheets(await file.text()), allDatasets, ds.key);
        } else if (/\.xml$/i.test(file.name)) {
          mapped = mapSheets(xmlToSheets(await file.text()), allDatasets, ds.key);
        } else {
          const X = await import("xlsx");
          const wb = X.read(await file.arrayBuffer(), { type: "array" });
          mapped = mapWorkbook(X, wb, allDatasets, ds.key);
        }
        const { imports, unmatched } = mapped;
        if (!imports.length) {
          const first = unmatched[0];
          throw Error(
            `لم يتم التعرف على أي جدول في الملف. ` +
              `الأعمدة المطلوبة لجدول «${ds.label}»: ${ds.fields.map((f) => f.label).join("، ")}.` +
              (first?.headers?.length
                ? ` الأعمدة الموجودة في الورقة «${first.sheet}»: ${first.headers.join("، ")}.`
                : " الملف فارغ أو لا يحتوي عناوين أعمدة."),
          );
        }
        addRows(imports);
        const total = imports.reduce((a, i) => a + i.rows.length, 0);
        const lines = imports.map(
          (i) =>
            `«${i.sheet}» ← ${i.label}: ${i.rows.length} سجل (${i.matched}/${i.total} عمود)`,
        );
        const skipped = unmatched.length
          ? ` | أوراق لم تُطابق أي جدول: ${unmatched.map((u) => u.sheet).join("، ")}`
          : "";
        const target = imports.find((i) => i.key === ds.key);
        if (!target && imports[0]) setDsKey(imports[0].key);
        setImportMsg(`تم استيراد ${total} سجل — ${lines.join(" | ")}${skipped}`);
        return;
      }
      let data = [];
      if (/\.csv$/i.test(file.name)) {
        const aoa = import_papaparse.default.parse(await file.text(), {
          header: false,
          skipEmptyLines: true,
        }).data;
        const r = await rowsFromAoaChunked(aoa, ds.fields, {
          onProgress: (p) => setImportMsg(`جارٍ معالجة السجلات... ${Math.round(p * 100)}%`),
        });
        if (!r.rows.length)
          throw Error(
            `لم يتم العثور على أعمدة مطابقة لجدول «${ds.label}». المطلوب: ${ds.fields.map((f) => f.label).join("، ")}.`,
          );
        addRows([{ key: ds.key, rows: r.rows }]);
        setImportMsg(`تم استيراد ${r.rows.length} سجل إلى «${ds.label}»`);
        return;
      } else if (/\.pdf$/i.test(file.name)) {
        data = await extractPdfRows(file, ds.fields, setImportMsg);
      } else throw Error("صيغة غير مدعومة. استخدم Excel أو CSV أو JSON أو XML أو PDF");
      const valid = data
        .map((r) =>
          Object.fromEntries(
            ds.fields.map((f) => [
              f.key,
              String(r[f.label] ?? r[f.key] ?? "").trim(),
            ]),
          ),
        )
        .filter((r) => Object.values(r).some(Boolean));
      if (!valid.length)
        throw Error("لم يتم العثور على أعمدة مطابقة. استخدم قالب الأعمدة.");
      addRows([{ key: ds.key, rows: valid }]);
      setImportMsg(`تم استيراد ${valid.length} سجل`);
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "تعذر قراءة الملف");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function addPdfs(files, meta) {
    if (!files?.length) return;
    setBusy(true);
    setMsg("");
    try {
      for (const file of Array.from(files)) {
        if (!/\.pdf$/i.test(file.name)) continue;
        const extracted = await extractPdfPages(file, { onStatus: setMsg });
        const text = extracted.text;
        await saveRegulation({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.pdf$/i, ""),
          text,
          addedAt: /* @__PURE__ */ new Date().toISOString().slice(0, 10),
          blob: file,
          ...(typeof meta?.sourceNote === "string" && meta.sourceNote ? { sourceNote: meta.sourceNote } : {}),
        });
        if (!text.trim())
          setMsg(
            `تم حفظ ${file.name} لكن لم يُستخرج منه نص حتى بعد OCR (تحقق من جودة المسح أو من الاتصال بالإنترنت)`,
          );
        else if (extracted.garbledPages.length)
          setMsg(
            `تم حفظ ${file.name}، لكن نص ${extracted.garbledPages.length} صفحة منه ما زال مشوّهًا ولن يُعرض كسند قانوني. اتصل بالإنترنت (لتفعيل OCR) وأعد رفع الملف.`,
          );
        else if (extracted.repairedPages.length)
          setMsg(
            `تم حفظ ${file.name} وإصلاح الحروف المتكررة في ${extracted.repairedPages.length} صفحة بصورة تقريبية. لنص أدق اتصل بالإنترنت وأعد رفع الملف ليُقرأ بـ OCR.`,
          );
        else if (extracted.ocrPages.length)
          setMsg(`تم حفظ ${file.name} (قُرئت ${extracted.ocrPages.length} صفحة بـ OCR)`);
      }
      setDocs(await listRegulations());
    } catch {
      setMsg("تعذر قراءة ملف PDF");
    } finally {
      setBusy(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  }
  async function saveReport() {
    if (!sectorFindings.length) {
      setMsg("لا توجد ملاحظات لحفظها في هذا النشاط");
      return;
    }
    const date = /* @__PURE__ */ new Date().toISOString().slice(0, 10);
    const report = {
      id: crypto.randomUUID(),
      name: `تقرير ${sector.label} ${date} (${reports.length + 1})`,
      date,
      compliance: complianceOf(sectorStore, sectorFindings),
      findings: sectorFindings.map((f) => ({
        key: f.key,
        dataset: f.dataset,
        test: f.test,
        ref: f.ref,
        severity: f.finalSeverity,
        detail: f.detail,
      })),
      observations,
    };
    setReports((p) => [...p, report]);
    try {
      await downloadReportPdf(report, datasetLabel);
      setMsg("تم حفظ التقرير وتنزيله كملف PDF");
    } catch {
      setMsg("تم حفظ التقرير، لكن تعذر إنشاء ملف PDF");
    }
  }
  async function importReport(file) {
    if (!file) return;
    try {
      if (!/\.pdf$/i.test(file.name)) throw Error();
      const fs = parseReportText(await extractPdfText(file)).map((f) => ({
        ...f,
        key: findingKey(f.dataset, f.test, f.ref),
      }));
      if (!fs.length) throw Error();
      setReports((p) => [
        ...p,
        {
          id: crypto.randomUUID(),
          name: file.name.replace(/\.pdf$/i, ""),
          date: new Date(file.lastModified).toISOString().slice(0, 10),
          findings: fs,
        },
      ]);
      setMsg(`تم استيراد تقرير سابق يحتوي ${fs.length} ملاحظة`);
    } catch {
      setMsg(
        "تعذر قراءة التقرير. استخدم ملف PDF مصدّر من رصد أو يحتوي ملاحظات بمستويات مخاطر.",
      );
    } finally {
      if (reportRef.current) reportRef.current.value = "";
    }
  }
  function openDoc(id) {
    const d = docs.find((x) => x.id === id);
    if (!d) return;
    const url = URL.createObjectURL(d.blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 6e4);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "view-heading",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
                children: "تدقيق الأنشطة والعمليات",
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                className: "mt-2 text-xs text-muted-foreground",
                children:
                  "بيانات الأنشطة والعمليات مرتبطة بالأنظمة والتعليمات والتقارير السابقة لتقييم المخاطر.",
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "header-actions",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                variant: "outline",
                onClick: saveReport,
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, {}),
                  "حفظ كتقرير",
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                variant: "ink",
                onClick: () => exportExcel(),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {}),
                  "تصدير الكل Excel",
                ],
              }),
            ],
          }),
        ],
      }),
      msg &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          role: "status",
          className: "mb-4 rounded-md bg-muted px-4 py-3 text-xs",
          children: msg,
        }),
      auditTab === "audit" &&
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RejectedAlert, {
        message: alertMsg,
        rejectedLog,
        Button,
        onDismiss: () => setAlertMsg(""),
        onDownload: () => {
          const csv = (rejectedLog ?? [])
            .map((x) => `# ${x.ds.label}\n${rejectedToCsv(x.ds, x.rejected)}`)
            .join("\n\n");
          const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = "rejected-records.csv";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 6e4);
        },
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoBar, {
        Button,
        active: demoActive,
        hasData:
          Object.values(store).some((r) => Array.isArray(r) && r.length) ||
          reports.some((r) => !r.seed),
        hasSnapshot: hasDemoSnapshot,
        summary: `${findings.length} ملاحظة مكتشفة حاليًا.`,
        onLoad: loadDemo,
        onExit: exitDemo,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
        className: "stats-grid",
        children: auditSectors.map((s) => {
          const fs = findings.filter((f) => f.sector === s.key);
          const lv = fs.some((f) => f.finalSeverity === "high")
            ? "high"
            : riskLevel(fs);
          const count = s.datasets.reduce(
            (a, d) => a + (store[d.key]?.length ?? 0),
            0,
          );
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              onClick: () => pickSector(s.key),
              className: "stat-card text-start",
              style:
                s.key === sectorKey ? { borderColor: "var(--ink)" } : void 0,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                  className: "text-xs font-semibold",
                  children: s.label,
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                  className: "mt-1 text-[10px] text-muted-foreground",
                  dir: "ltr",
                  children: s.en,
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                  className:
                    "mt-3 flex items-center justify-between gap-2 text-xs",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
                      children: [count, " سجل · ", fs.length, " ملاحظة"],
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                      className: `status-badge ${count ? sevClass[lv] : "bg-muted text-muted-foreground"}`,
                      children: count ? sevLabel[lv] : "غير مقيّم",
                    }),
                  ],
                }),
              ],
            },
            s.key,
          );
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "table-panel stat-card",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
            className: "text-base font-semibold",
            children: sector.label,
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "mt-1 text-xs text-muted-foreground",
            children: sector.goal,
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "mt-4 flex flex-wrap gap-2",
            children: sector.datasets.map((d) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                Button,
                {
                  size: "sm",
                  variant: d.key === ds.key ? "ink" : "outline",
                  onClick: () => {
                    setDsKey(d.key);
                    setDraft({});
                    setSel(/* @__PURE__ */ new Set());
                  },
                  children: [
                    d.label,
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
                      className: "text-[10px] opacity-70",
                      children: ["(", store[d.key]?.length ?? 0, ")"],
                    }),
                  ],
                },
                d.key,
              ),
            ),
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "table-panel stat-card",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "flex flex-wrap items-center justify-between gap-3",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
                    className: "font-semibold",
                    children: ds.label,
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    className: "text-[10px] text-muted-foreground",
                    dir: "ltr",
                    children: ds.key,
                  }),
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                className: "flex flex-wrap gap-2",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    onClick: () =>
                      saveCsv(
                        `${ds.key}-template.csv`,
                        import_papaparse.default.unparse({
                          fields: ds.fields.map((f) => f.label),
                          data: [],
                        }),
                      ),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDown, {}),
                      "قالب الأعمدة",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    disabled: !rows.length,
                    onClick: () => exportExcel(ds.key),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {}),
                      "تصدير الجدول Excel",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    onClick: () => fileRef.current?.click(),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {}),
                      "استيراد Excel / PDF",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                    ref: fileRef,
                    type: "file",
                    accept: ".csv,.xlsx,.xls,.json,.xml,.pdf,application/pdf",
                    hidden: true,
                    onChange: (e) => importFile(e.target.files?.[0]),
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    disabled: !sel.size,
                    onClick: () => deleteRows(sel),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {}),
                      `حذف المحدد (${sel.size})`,
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    disabled: !rows.length,
                    onClick: deleteAllRows,
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {}),
                      "حذف كل السجلات",
                    ],
                  }),
                ],
              }),
            ],
          }),
          importMsg &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
              role: "status",
              className: "mt-3 rounded-md bg-muted px-4 py-3 text-xs leading-6",
              children: importMsg,
            }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
            onSubmit: add,
            className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
            children: [
              ds.fields.map((f) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "label",
                  {
                    className: "grid gap-1 text-xs",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                        children: f.label,
                      }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                        className: "field-input",
                        type:
                          f.type === "date"
                            ? "date"
                            : f.type === "number"
                              ? "number"
                              : "text",
                        step: "any",
                        value: draft[f.key] ?? "",
                        onChange: (e) =>
                          setDraft((p) => ({
                            ...p,
                            [f.key]: e.target.value,
                          })),
                      }),
                    ],
                  },
                  f.key,
                ),
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                className: "flex items-end",
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                  type: "submit",
                  variant: "ink",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {}),
                    "إضافة سجل",
                  ],
                }),
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "table-scroll mt-4",
            children: rows.length
              ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
                  className: "data-table",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "tr",
                        {
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
                              children: [
                                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                                  type: "checkbox",
                                  "aria-label": "تحديد الكل",
                                  checked: rows.length > 0 && sel.size === rows.length,
                                  onChange: (e) =>
                                    setSel(
                                      e.target.checked
                                        ? new Set(rows.map((_, j) => j))
                                        : /* @__PURE__ */ new Set(),
                                    ),
                                }),
                                " #",
                              ],
                            }),
                            ds.fields.map((f) =>
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "th",
                                { children: f.label },
                                f.key,
                              ),
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "المخاطر",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "th",
                              {},
                            ),
                          ],
                        },
                      ),
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
                      children: rows.map((r, i) => {
                        const fs = dsFindings.filter((f) => f.row === i);
                        const lv = fs.some((f) => f.finalSeverity === "high")
                          ? "high"
                          : riskLevel(fs);
                        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                          "tr",
                          {
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                                "td",
                                {
                                  children: [
                                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                                      type: "checkbox",
                                      "aria-label": `تحديد السجل ${i + 1}`,
                                      checked: sel.has(i),
                                      onChange: (e) =>
                                        setSel((p) => {
                                          const n2 = new Set(p);
                                          e.target.checked ? n2.add(i) : n2.delete(i);
                                          return n2;
                                        }),
                                    }),
                                    " ",
                                    i + 1,
                                  ],
                                },
                              ),
                              ds.fields.map((f) =>
                                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                  "td",
                                  { children: r[f.key] },
                                  f.key,
                                ),
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                {
                                  children: /* @__PURE__ */ (0,
                                  import_jsx_runtime.jsx)("span", {
                                    className: `status-badge ${sevClass[lv]}`,
                                    children: sevLabel[lv],
                                  }),
                                },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                {
                                  children: /* @__PURE__ */ (0,
                                  import_jsx_runtime.jsx)(Button, {
                                    variant: "ghost",
                                    size: "icon",
                                    "aria-label": "حذف",
                                    onClick: () => deleteRows(/* @__PURE__ */ new Set([i])),
                                    children: /* @__PURE__ */ (0,
                                    import_jsx_runtime.jsx)(Trash2, {}),
                                  }),
                                },
                              ),
                            ],
                          },
                          i,
                        );
                      }),
                    }),
                  ],
                })
              : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                  className: "py-6 text-center text-xs text-muted-foreground",
                  children: "لا توجد سجلات بعد. أضف سجلًا أو استورد ملفًا.",
                }),
          }),
        ],
      }),
        ],
      }),
      auditTab !== "audit" &&
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "analysis-grid",
        children: [
          auditTab === "rules" &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "table-panel stat-card",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                className: "flex flex-wrap items-center justify-between gap-2",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
                    className: "flex items-center gap-2 font-semibold",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, {
                        size: 18,
                      }),
                      "الأنظمة والتعليمات",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    disabled: busy,
                    onClick: () => pdfRef.current?.click(),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {}),
                      busy ? "جارٍ القراءة…" : "رفع ملفات PDF",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                    ref: pdfRef,
                    type: "file",
                    accept: "application/pdf,.pdf",
                    multiple: true,
                    hidden: true,
                    onChange: (e) => addPdfs(e.target.files),
                  }),
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                className: "mt-1 text-xs text-muted-foreground",
                children:
                  "تُقرأ نصوص الملفات وتُربط كل ملاحظة بأقرب مادة أو فقرة ذات صلة.",
              }),
              officialMsg
                ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                    className: "mt-1 text-xs text-muted-foreground",
                    role: "status",
                    "data-testid": "official-sync-status",
                    children: officialMsg,
                  })
                : null,
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegalUrlImport, {
                disabled: busy,
                onFile: (file, meta) => addPdfs([file], meta),
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
                className: "mt-3 space-y-2 text-xs",
                children: docs.length
                  ? docs.map((d) =>
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "li",
                        {
                          className: "flex flex-wrap items-center gap-2",
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              FileText,
                              { size: 15 },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "button",
                              {
                                className:
                                  "flex-1 truncate text-start underline-offset-4 hover:underline",
                                onClick: () => openDoc(d.id),
                                children: d.name,
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "span",
                              {
                                className: "text-muted-foreground",
                                children: d.text.trim()
                                  ? `${segmentDoc(d.text).length} فقرة`
                                  : "بلا نص",
                              },
                            ),
                            isOfficialDoc(d)
                              ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                                  className: "text-muted-foreground",
                                  title: "مصدره الموقع الرسمي ويتجدد تلقائياً",
                                  children: "رسمي",
                                })
                              : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              Button,
                              {
                                variant: "ghost",
                                size: "icon",
                                "aria-label": `حذف ${d.name}`,
                                onClick: async () => {
                                  await deleteRegulation(d.id);
                                  setDocs(await listRegulations());
                                },
                                children: /* @__PURE__ */ (0,
                                import_jsx_runtime.jsx)(Trash2, {}),
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryMeta, {
                              doc: d,
                              onChange: async (patch) => {
                                await updateRegulationMeta(d.id, patch);
                                setDocs(await listRegulations());
                              },
                            }),
                          ],
                        },
                        d.id,
                      ),
                    )
                  : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
                      className: "text-muted-foreground",
                      children: "لم تُرفع أنظمة بعد.",
                    }),
              }),
            ],
          }),
          auditTab === "reports" &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "table-panel stat-card",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                className: "flex flex-wrap items-center justify-between gap-2",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
                    className: "flex items-center gap-2 font-semibold",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, {
                        size: 18,
                      }),
                      "التقارير السابقة",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    onClick: () => reportRef.current?.click(),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {}),
                      "استيراد تقرير PDF",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                    ref: reportRef,
                    type: "file",
                    accept: "application/pdf,.pdf",
                    hidden: true,
                    onChange: (e) => importReport(e.target.files?.[0]),
                  }),
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                className: "mt-1 text-xs text-muted-foreground",
                children:
                  "الملاحظة المتكررة لنفس السجل ترفع مستوى المخاطر درجة واحدة.",
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackupPanel, {}),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
                className: "mt-3 space-y-2 text-xs",
                children: reports.length
                  ? reports.map((r) =>
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "li",
                        {
                          className: "flex items-center gap-2",
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "span",
                              {
                                className: "flex-1 truncate",
                                children: r.name,
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "span",
                              {
                                className: "text-muted-foreground",
                                dir: "ltr",
                                children: r.date,
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                              "span",
                              {
                                className: "text-muted-foreground",
                                children: [r.findings.length, " ملاحظة"],
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              Button,
                              {
                                variant: "ghost",
                                size: "icon",
                                "aria-label": `حذف ${r.name}`,
                                onClick: () => {
                                  markSeedRemoved(r.id);
                                  setReports((p) =>
                                    p.filter((x) => x.id !== r.id),
                                  );
                                },
                                children: /* @__PURE__ */ (0,
                                import_jsx_runtime.jsx)(Trash2, {}),
                              },
                            ),
                          ],
                        },
                        r.id,
                      ),
                    )
                  : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
                      className: "text-muted-foreground",
                      children: "لا توجد تقارير محفوظة.",
                    }),
              }),
              resolved.length > 0 &&
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
                  className: "mt-3 text-xs text-success",
                  children: [
                    resolved.length,
                    " ملاحظة من آخر تقرير لم تعد قائمة (تمت معالجتها).",
                  ],
                }),
            ],
          }),
        ],
      }),
      auditTab === "audit" &&
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        children: [
      sectorKey === "finance" &&
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "table-panel stat-card",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
            className: "flex items-center gap-2 font-semibold",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, {
                size: 18,
              }),
              "معاملات التدقيق",
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "mt-1 text-xs text-muted-foreground",
            children:
              "قيم تحددها أنت وتُستخدم في تصنيف التأخير والفروقات إلى مرتفعة ومتوسطة ومنخفضة.",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
            children: paramFields.map((f) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "label",
                {
                  className: "grid gap-1 text-xs",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                      children: f.label,
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                      className: "field-input",
                      type: "number",
                      min: f.min,
                      step: "any",
                      value: params[f.key],
                      onChange: (e) => {
                        const v = Number(e.target.value);
                        if (
                          e.target.value !== "" &&
                          Number.isFinite(v) &&
                          v >= f.min
                        )
                          setParams((p) => ({
                            ...p,
                            [f.key]: v,
                          }));
                      },
                    }),
                  ],
                },
                f.key,
              ),
            ),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "mt-3",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
              variant: "outline",
              size: "sm",
              onClick: () => setParams(defaultParams),
              children: "استعادة القيم الأولية",
            }),
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
        className: "stats-grid",
        children: [
          {
            k: "مرتفعة المخاطر",
            v: counts.high,
            l: "high",
          },
          {
            k: "متوسطة المخاطر",
            v: counts.medium,
            l: "medium",
          },
          {
            k: "منخفضة المخاطر",
            v: counts.low,
            l: "low",
          },
          {
            k: "إجمالي الملاحظات",
            v: sectorFindings.length,
            l: "all",
          },
        ].map((s) =>
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              type: "button",
              "aria-pressed": level === s.l,
              onClick: () => setLevel(level === s.l ? "all" : s.l),
              className: "stat-card text-start",
              style: level === s.l ? { borderColor: "var(--ink)" } : void 0,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                  className: "text-xs text-muted-foreground",
                  children: s.k,
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                  className: "stat-value",
                  dir: "ltr",
                  children: s.v,
                }),
              ],
            },
            s.k,
          ),
        ),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
        className: "-mt-3 mb-4 text-xs text-muted-foreground",
        children: [
          "متكررة من تقارير سابقة: ",
          repeated,
          " · مرتبطة بنص نظامي: ",
          linked,
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "table-panel stat-card",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "flex flex-wrap items-center justify-between gap-3",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
                className: "flex items-center gap-2 font-semibold",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
                    size: 18,
                  }),
                  "نتائج التحليل وتقييم المخاطر (",
                  visible.length,
                  ")",
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                className: "flex flex-wrap gap-2",
                children: ["all", "high", "medium", "low"].map((l) =>
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    Button,
                    {
                      size: "sm",
                      variant: level === l ? "ink" : "outline",
                      onClick: () => setLevel(l),
                      children: l === "all" ? "الكل" : sevLabel[l],
                    },
                    l,
                  ),
                ),
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "mt-1 text-xs text-muted-foreground",
            children:
              "اختبارات اتساق ومطابقة بين الجداول، مقارنة بالتقارير السابقة، وربط بالأنظمة المرفوعة.",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "table-scroll mt-4",
            children: visible.length
              ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
                  className: "data-table",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "tr",
                        {
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "المخاطر",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "الجدول",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "المعرّف",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "الاختبار",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "التفاصيل",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "مقارنة بالتقارير السابقة",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "المرجع النظامي",
                            }),
                          ],
                        },
                      ),
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
                      children: visible.map((f, i) =>
                        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                          "tr",
                          {
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                {
                                  children: /* @__PURE__ */ (0,
                                  import_jsx_runtime.jsx)("span", {
                                    className: `status-badge ${sevClass[f.finalSeverity]}`,
                                    children: sevLabel[f.finalSeverity],
                                  }),
                                },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                { children: datasetLabel(f.dataset) },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                { children: f.ref || f.row + 1 },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                { children: f.test },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                { children: f.detail },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                {
                                  children: f.repeat
                                    ? /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsxs)("span", {
                                        className:
                                          "status-badge bg-danger-soft text-danger",
                                        children: [
                                          f.repeat.exact
                                            ? "متكررة"
                                            : "نمط متكرر",
                                          " · ",
                                          f.repeat.report,
                                        ],
                                      })
                                    : /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)("span", {
                                        className:
                                          "status-badge bg-muted text-muted-foreground",
                                        children: "جديدة",
                                      }),
                                },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                {
                                  className: "max-w-72 text-[11px]",
                                  children: f.regulation
                                    ? /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsxs)("button", {
                                        className: "text-start hover:underline",
                                        title: f.regulation.confidence
                                          ? `اقتراح آلي (ثقة ${CONFIDENCE_LABEL[f.regulation.confidence]}، ${f.regulation.matched}/${f.regulation.of} كلمات): تحقق من النص قبل الاستشهاد به`
                                          : void 0,
                                        onClick: () =>
                                          openDoc(f.regulation.docId),
                                        children: [
                                          /* @__PURE__ */ (0,
                                          import_jsx_runtime.jsxs)("b", {
                                            children: [f.regulation.doc, ":"],
                                          }),
                                          " ",
                                          f.regulation.excerpt,
                                        ],
                                      })
                                    : /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)("span", {
                                        className: "text-muted-foreground",
                                        title: f.legal?.text,
                                        children: f.legal
                                          ? `${f.legal.instruments[0]} (${f.legal.note})`
                                          : "—",
                                      }),
                                },
                              ),
                            ],
                          },
                          i,
                        ),
                      ),
                    }),
                  ],
                })
              : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                  className: "py-6 text-center text-xs text-muted-foreground",
                  children: "لا توجد ملاحظات حالياً.",
                }),
          }),
          resolved.length > 0 &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
              className: "mt-4",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
                  className: "text-xs font-semibold",
                  children: ["ملاحظات معالجة منذ «", resolved[0].report, "»"],
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
                  className: "mt-2 space-y-1 text-xs text-muted-foreground",
                  children: resolved.map((r) =>
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      "li",
                      {
                        children: [
                          datasetLabel(r.dataset),
                          " · ",
                          r.ref,
                          " · ",
                          r.test,
                        ],
                      },
                      r.key,
                    ),
                  ),
                }),
              ],
            }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ObservationsPanel, {
        observations,
        sevLabel,
        sevClass,
        datasetLabel,
        onToggleApprove: toggleApprove,
        onDelete: (id) => {
          const n = new Set(deletedObs).add(id);
          saveIds("deleted", n);
          setDeletedObs(n);
        },
        deletedCount,
        onRestore: () => {
          saveIds("deleted", new Set());
          setDeletedObs(new Set());
        },
        decisions: obsDecisions,
        onDecide: decideObservation,
        onEdit: editObservation,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegalCoveragePanel, {
        observations,
        docs,
        links: legalLinks,
        datasetLabel,
        onLink: (key, link) => {
          const n = { ...legalLinks, [key]: link };
          saveLinks(n);
          setLegalLinks(n);
        },
        onUnlink: (key) => {
          const n = { ...legalLinks };
          delete n[key];
          saveLinks(n);
          setLegalLinks(n);
        },
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocReviewPanel, {}),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewStatsPanel, {
        log: reviewLog,
        threshold: reviewThreshold,
        onThresholdChange: (t) => {
          saveThreshold(t);
          setReviewThreshold(t);
        },
        datasetLabel,
      }),
    
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalibrationPanel, {
        calibration,
        setCalibration,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExecutiveDashboard, {
        store,
        findings,
        sectors: auditSectors,
        resolved,
        historyStats,
        sectorLabel,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvancedPanel, {
        observations,
        Button,
        store: sectorStore,
        findings: sectorFindings,
        reports,
        ds,
        sector,
        sectors: [sector],
        sevLabel,
        sevClass,
        datasetLabel,
      }),
        ],
      }),
    ],
  });
}
