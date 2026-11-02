import { useEffect, useState } from "react";

// مراحل المساعد حسب نوع الطلب: كل مرحلة تبدأ بعد `at` ثانية من بدء الانتظار.
// هي تقدير زمني لما يفعله المساعد فعليًا (قراءة السياق ← التحليل ← الكتابة)، وتتحول إلى رسالة صريحة إن طال الانتظار.
export const CHAT_PHASES = {
  chat: [
    { at: 0, label: "يقرأ سؤالك…" },
    { at: 1.5, label: "يطّلع على ملخص بياناتك في رصد…" },
    { at: 4, label: "يفكّر في الإجابة…" },
    { at: 12, label: "ما زال يعمل على الرد…" },
    { at: 22, label: "الخدمة مشغولة، يعيد المحاولة…" },
  ],
  analyze: [
    { at: 0, label: "يقرأ ملخص بياناتك…" },
    { at: 2, label: "يحلّل الملاحظات حسب القطاع والاختبار…" },
    { at: 6, label: "يقارن الأنماط والتكرار بالتقارير السابقة…" },
    { at: 11, label: "يرتّب المخاطر والتوصيات…" },
    { at: 18, label: "يكتب التقرير التحليلي…" },
    { at: 30, label: "الخدمة مشغولة، يعيد المحاولة…" },
  ],
  report: [
    { at: 0, label: "يقرأ الملاحظات الحالية…" },
    { at: 3, label: "يربط كل ملاحظة بسندها ومراجعها…" },
    { at: 8, label: "يصيغ مسودة التقرير بلسان المدقق…" },
    { at: 20, label: "يراجع الصياغة والتوصيات…" },
    { at: 35, label: "الخدمة مشغولة، يعيد المحاولة…" },
  ],
};

/** يعيد نص المرحلة الحالية بحسب الزمن المنقضي منذ تفعيل الانتظار. */
export function usePhaseLabel(phases, active) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return undefined;
    }
    const start = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - start) / 1000), 400);
    return () => clearInterval(t);
  }, [active]);
  let label = phases[0]?.label ?? "";
  for (const p of phases) if (elapsed >= p.at) label = p.label;
  return label;
}

/** ثلاث نقاط متحركة + وصف لما يفعله المساعد الآن (يتغير مع تغير المرحلة). */
export function ThinkingIndicator({ label, compact = false }) {
  return (
    <span className={`rasd-think${compact ? " rasd-think-compact" : ""}`} role="status" aria-live="polite">
      <span className="rasd-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span key={label} className="rasd-think-label">
        {label}
      </span>
    </span>
  );
}
