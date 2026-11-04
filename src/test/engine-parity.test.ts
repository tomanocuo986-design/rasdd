// اختبار تكافؤ المحركين (انظر docs/ENGINE.ar.md): يشغّل محرك الواجهة (JS، المرجع) ومحرك Python القديم
// على بيانات العرض نفسها ويقارن عدد الملاحظات لكل اختبار عبر جدول مطابقة صريح.
//
// الغرض ليس إثبات أن المحركين متطابقان (هما ليسا كذلك)، بل منع الانحراف الصامت:
//  - أي اختبار جديد في Python لا يظهر في جدول المطابقة => فشل (يجب تصنيفه).
//  - أي اختلاف غير مدرج في KNOWN_DIVERGENCES => فشل.
//  - أي اختلاف مدرج تغيّر رقماه => فشل (يجب أن يُراجَع قصداً).
// يُتخطى الاختبار إن لم يتوفر python3 مع pandas (CI يثبّتهما).
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { runAudit } from "@/rasd/workspace.jsx";
import { buildDemoStore, DEMO_PARAMS } from "@/rasd/demo-data.js";

const T = Date.parse("2026-11-01");
const SCRIPT = path.resolve(__dirname, "../../python/dump_findings.py");
const PY = process.env["PYTHON"] || "python3";

/** اسم اختبار Python => مطابِق لأسماء اختبارات JS المقابلة (يطابق بالبادئة). */
export const PY_TO_JS: Record<string, string[]> = {
  "تجزئة أوامر شراء لمورد ضمن فترة متقاربة": ["احتمال تجزئة مشتريات"],
  "تركّز المشتريات المباشرة على مورد واحد": ["استعلام آلي: تركّز المشتريات المباشرة على مورد واحد"],
  "تقادم ذمة إيراد": ["استعلام آلي: تقادم ذمة إيراد"],
  "مؤشر احتيال: تطابق الرقم الوطني بين مورد وموظف": ["مؤشر احتيال: تطابق الرقم الوطني بين مورد وموظف"],
  // Python يفحص أول حقل في جداول المعرّفات الفريدة (UNIQUE_ID_DATASETS)؛ في بيانات العرض لا يتكرر إلا رقم الرخصة.
  "تكرار معرّف السجل": ["تكرار رقم الرخصة"],
};

/**
 * اختلافات معروفة ومقصودة التوثيق: [عدد Python، عدد JS المقابل] + السبب.
 * عند إصلاح السبب يجب حذف الإدخال (فيصبح الاختبار يطلب التطابق).
 */
export const KNOWN_DIVERGENCES: Record<string, { py: number; js: number; why: string }> = {};

type PyOut = { counts: Record<string, number>; total: number; byDataset: Record<string, Record<string, number>> };

function runPython(store: unknown): PyOut | null {
  const probe = spawnSync(PY, ["-c", "import pandas"], { encoding: "utf8" });
  if (probe.status !== 0) return null;
  const r = spawnSync(PY, [SCRIPT], { input: JSON.stringify({ today: "2026-11-01", store }), encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`python engine failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

const store = buildDemoStore(T);
const js = runAudit(store, T, DEMO_PARAMS);
const jsCounts: Record<string, number> = {};
for (const f of js as { test: string }[]) jsCounts[f.test] = (jsCounts[f.test] ?? 0) + 1;
const jsCountFor = (prefixes: string[]) =>
  Object.entries(jsCounts)
    .filter(([t]) => prefixes.some((p) => t.startsWith(p)))
    .reduce((s, [, n]) => s + n, 0);

const py = runPython(store);

describe.skipIf(!py)("JS (reference) vs Python engine parity on demo data", () => {
  it("every Python test is classified in the mapping table", () => {
    const unmapped = Object.keys(py!.counts).filter((t) => !(t in PY_TO_JS));
    expect(unmapped, `اختبارات Python غير مصنفة في PY_TO_JS: ${unmapped.join(" | ")}`).toEqual([]);
  });

  it("mapped JS tests exist in the reference engine", () => {
    for (const [pyTest, jsTests] of Object.entries(PY_TO_JS)) {
      if (!(pyTest in py!.counts)) continue;
      for (const j of jsTests) expect(Object.keys(jsCounts).some((t) => t.startsWith(j)), `${pyTest} -> ${j}`).toBe(true);
    }
  });

  it("counts match per test, except documented divergences (which must stay exactly as documented)", () => {
    const problems: string[] = [];
    for (const [pyTest, pyCount] of Object.entries(py!.counts)) {
      const jsCount = jsCountFor(PY_TO_JS[pyTest] ?? []);
      const known = KNOWN_DIVERGENCES[pyTest];
      if (known) {
        if (known.py !== pyCount || known.js !== jsCount)
          problems.push(`تغيّر اختلاف موثّق «${pyTest}»: متوقع py=${known.py}/js=${known.js} والفعلي py=${pyCount}/js=${jsCount}`);
      } else if (pyCount !== jsCount) problems.push(`اختلاف غير موثّق «${pyTest}»: py=${pyCount} js=${jsCount}`);
    }
    expect(problems).toEqual([]);
  });

  it("documented divergences are not stale (each still diverges)", () => {
    for (const [t, k] of Object.entries(KNOWN_DIVERGENCES)) expect(k.py !== k.js, `${t} لم يعد مختلفاً: احذفه من KNOWN_DIVERGENCES`).toBe(true);
  });

  it("Python duplicate-id test flags only datasets with a unique identifier (regression: it used to flag vehicle numbers and bank accounts)", () => {
    const by = py!.byDataset["تكرار معرّف السجل"] ?? {};
    expect(Object.keys(by)).toEqual(["Revenue_Profession_Licenses"]);
  });

  it("Python covers only a small part of the reference engine's tests (guards against pretending parity)", () => {
    const pyShare = Object.keys(py!.counts).length / Object.keys(jsCounts).length;
    expect(pyShare).toBeLessThan(0.25);
  });
});
