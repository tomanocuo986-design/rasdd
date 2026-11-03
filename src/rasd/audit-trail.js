// إرسال أحداث قرارات المدقق إلى سجل التدقيق على الخادم (/api/auth action:"event").
// الخادم يختم الحدث باسم الجلسة ودورها؛ ولا يُرسل هنا نص الملاحظات ولا بيانات التدقيق، بل معرّفها ونوع القرار فقط.
// أطلق وانسَ: أي فشل (بلا اتصال، جلسة منتهية، تشغيل اختبارات) يُتجاهل ولا يعطّل عمل المدقق.
export function trackEvent(event, target = "", detail = "") {
  try {
    if (typeof fetch !== "function" || typeof location === "undefined") return;
    void fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ action: "event", event, target: String(target).slice(0, 300), detail: String(detail).slice(0, 300) }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
