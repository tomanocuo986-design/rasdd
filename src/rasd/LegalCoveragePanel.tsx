// @ts-nocheck
import { useState } from "react";
import { LegalBadge } from "./LegalBadge";
import { linkKey } from "./legal-status";

/**
 * تغطية السند القانوني: لكل اختبار مرصود، هل له سند من المكتبة؟ وإن لم يكن يربطه المدقق بمادة من ملف مرفوع.
 * الربط يدوي ومن نص الملف المرفوع، ولا يولّد التطبيق أي رقم مادة.
 */
export function LegalCoveragePanel({ observations, docs, links, onLink, onUnlink, datasetLabel }) {
  const [open, setOpen] = useState(null);
  const [docId, setDocId] = useState("");
  const [article, setArticle] = useState("");
  const [excerpt, setExcerpt] = useState("");

  const rows = observations.map((o) => ({ o, key: linkKey(o.dataset, o.test), link: links[linkKey(o.dataset, o.test)] }));
  const covered = rows.filter((r) => r.o.legalBasis.source === "library").length;

  const start = (r) => {
    setOpen(r.key);
    setDocId(r.link?.docId ?? docs[0]?.id ?? "");
    setArticle(r.link?.article ?? "");
    setExcerpt(r.link?.excerpt ?? "");
  };

  return (
    <section className="table-panel stat-card" data-testid="legal-coverage">
      <h3 className="font-semibold">
        تغطية السند القانوني: {covered} من {rows.length} اختبار بسند من المكتبة
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        ارفع الأنظمة والتعليمات في «مكتبة الأنظمة والتعليمات». ما لم يطابقه التطبيق تلقائيًا اربطه هنا بمادة من الملف المرفوع (تكتب رقم المادة ونصها
        كما ورد في الملف). الروابط تُحفظ وتُطبَّق عند كل تحليل.
      </p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">لا توجد ملاحظات بعد.</p>
      ) : (
        <ul className="mt-3 grid gap-2 text-xs">
          {rows.map((r) => (
            <li key={r.key} className="rounded-md border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <b>{r.o.test}</b>
                <span className="text-muted-foreground">{datasetLabel(r.o.dataset)}</span>
                <LegalBadge o={r.o} />
                {r.link && <span className="text-muted-foreground">مربوط يدويًا بـ «{r.link.doc}»</span>}
                {r.o.legalBasis.source !== "library" || r.link ? (
                  <button type="button" className="rounded-md border px-2 py-1" disabled={!docs.length} onClick={() => start(r)}>
                    {r.link ? "تعديل الربط" : "ربط بمادة"}
                  </button>
                ) : null}
                {r.link && (
                  <button type="button" className="rounded-md border px-2 py-1 text-danger" onClick={() => onUnlink(r.key)}>
                    إزالة الربط
                  </button>
                )}
              </div>
              {!docs.length && r.o.legalBasis.source !== "library" && (
                <p className="mt-1 text-muted-foreground">لا توجد ملفات في المكتبة بعد؛ ارفع النظام أو التعليمات أولًا.</p>
              )}
              {open === r.key && (
                <div className="mt-2 grid gap-2">
                  <select className="rounded-md border px-2 py-1" value={docId} onChange={(e) => setDocId(e.target.value)} aria-label="الملف">
                    {docs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-md border px-2 py-1"
                    placeholder="رقم المادة كما في الملف (مثال: المادة 12)"
                    value={article}
                    onChange={(e) => setArticle(e.target.value)}
                  />
                  <textarea
                    className="rounded-md border px-2 py-1"
                    rows={3}
                    placeholder="نص المادة كما ورد في الملف المرفوع"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1"
                      disabled={!docId || !excerpt.trim()}
                      onClick={() => {
                        const d = docs.find((x) => x.id === docId);
                        onLink(r.key, { docId, doc: d?.name ?? "", article: article.trim(), excerpt: excerpt.trim(), at: new Date().toISOString() });
                        setOpen(null);
                      }}
                    >
                      حفظ الربط
                    </button>
                    <button type="button" className="rounded-md border px-2 py-1" onClick={() => setOpen(null)}>
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
