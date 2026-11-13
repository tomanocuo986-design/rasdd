import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AuditTrailTimeline } from "./AuditTrailTimeline";
import type { AuditEvent, ChainVerdict } from "./audit-chain";

type Status = "loading" | "ready" | "unauthenticated" | "forbidden" | "error";
type Payload = { verify: ChainVerdict; total: number; matched: number; events: AuditEvent[] };

const LIMITS = [50, 200, 500];

const field =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring";
const button =
  "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm text-foreground hover:bg-accent disabled:opacity-50";

export function AuditTrailPanel({
  target: initialTarget = "",
  limit: initialLimit = 200,
}: {
  target?: string;
  limit?: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<Payload | null>(null);
  const [target, setTarget] = useState(initialTarget);
  const [applied, setApplied] = useState(initialTarget);
  const [limit, setLimit] = useState(initialLimit);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const qs = new URLSearchParams({ audit: "1", limit: String(limit) });
      if (applied.trim()) qs.set("target", applied.trim());
      const r = await fetch(`/api/auth?${qs.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (r.status === 401) return setStatus("unauthenticated");
      if (r.status === 403) return setStatus("forbidden");
      if (!r.ok) return setStatus("error");
      const body = (await r.json()) as Payload;
      setData({ ...body, matched: body.matched ?? body.events.length });
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [applied, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setApplied(target);
  };

  return (
    <main dir="rtl" className="mx-auto w-full max-w-3xl space-y-4 p-4 text-foreground">
      <h1 className="text-lg font-semibold">سجل التدقيق المتسلسل</h1>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          aria-label="تصفية بمعرّف الهدف"
          placeholder="تصفية بمعرّف الهدف (اختياري)"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={`${field} min-w-[14rem] flex-1`}
        />
        <select
          aria-label="عدد الأحداث"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className={field}
        >
          {LIMITS.map((n) => (
            <option key={n} value={n}>
              آخر {n}
            </option>
          ))}
        </select>
        <button type="submit" className={button}>
          تطبيق
        </button>
        <button
          type="button"
          className={button}
          onClick={() => void load()}
          disabled={status === "loading"}
        >
          تحديث
        </button>
      </form>

      {status === "loading" ? (
        <p role="status" className="text-sm text-muted-foreground">
          جارٍ تحميل السجل…
        </p>
      ) : null}
      {status === "unauthenticated" ? (
        <p role="alert" data-testid="audit-unauth" className="text-sm text-destructive">
          سجّل الدخول لعرض السجل.
        </p>
      ) : null}
      {status === "forbidden" ? (
        <p role="alert" data-testid="audit-forbidden" className="text-sm text-destructive">
          عرض سجل التدقيق متاح للمراجع والمدير فقط.
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" data-testid="audit-error" className="text-sm text-destructive">
          تعذّر تحميل السجل، حاول مرة أخرى.
        </p>
      ) : null}
      {status === "ready" && data ? (
        <>
          <p className="text-xs text-muted-foreground">
            الإجمالي في السلسلة: {data.total} · المطابق للتصفية: {data.matched} · المعروض:{" "}
            {data.events.length}. التحقق يشمل السلسلة كاملة في الخادم ولا يعتمد على المتصفح.
          </p>
          <AuditTrailTimeline events={data.events} verify={data.verify} />
        </>
      ) : null}
    </main>
  );
}
