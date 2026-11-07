import { DEMO_MUNICIPALITY } from "./demo-data.js";

/**
 * شريط وضع العرض التجريبي في لوحة التدقيق (يستلم Button من workspace كي يستعمل أنماطه مثل «ink»):
 *  - منصة فارغة: بطاقة تدعو لتحميل بيانات «بلدية نموذجية» بضغطة واحدة.
 *  - العرض مفعّل: شريط تنبيه واضح بأن البيانات افتراضية مع زر الخروج (يعيد بيانات المستخدم السابقة إن وُجدت).
 *  - بيانات حقيقية موجودة: زر صغير يطلب تأكيدًا قبل الاستبدال (تُحفظ بياناتها وتعود عند الخروج).
 */
export function DemoBar({ Button, active, hasData, hasSnapshot, summary, onLoad, onExit }) {
  if (active) {
    return (
      <div
        role="status"
        data-testid="demo-banner"
        className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-xs"
      >
        <div>
          <strong>وضع العرض التجريبي</strong> — بيانات افتراضية بالكامل لـ «{DEMO_MUNICIPALITY}» وليست بيانات جهة حقيقية.
          {summary ? <span className="text-muted-foreground"> {summary}</span> : null}
          <div className="mt-1 text-muted-foreground">
            جرّب: افتح أي نشاط، اضغط «حفظ كتقرير»، ثم أعد تحميل الصفحة لترى أن النتائج محفوظة.
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onLoad}>
            إعادة تحميل العرض
          </Button>
          <Button variant="ink" size="sm" onClick={onExit}>
            {hasSnapshot ? "الخروج واستعادة بياناتي" : "الخروج من العرض"}
          </Button>
        </div>
      </div>
    );
  }
  if (!hasData) {
    return (
      <section
        data-testid="demo-empty"
        className="stat-card mb-4 flex flex-wrap items-center justify-between gap-4 border-dashed"
      >
        <div>
          <h2 className="text-base font-semibold">جرّب المنصة الآن دون إدخال أي بيانات</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            بضغطة واحدة تُملأ المؤشرات ببيانات افتراضية لـ «{DEMO_MUNICIPALITY}» (سندات قبض وصرف، تسويات بنكية، رواتب، وقود،
            مشتريات…) فترى كيف تكتشف رصد الانحرافات: صرف مزدوج، شيكات مكررة، حسابات بنكية مشتركة، تجزئة مشتريات وغيرها.
          </p>
        </div>
        <Button variant="ink" onClick={onLoad}>
          ▶ تحميل العرض التجريبي
        </Button>
      </section>
    );
  }
  return (
    <div className="mb-3 text-end">
      <Button variant="ghost" size="sm" onClick={onLoad}>
        تحميل العرض التجريبي (يستبدل بياناتك مؤقتًا)
      </Button>
    </div>
  );
}
