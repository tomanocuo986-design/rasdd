import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { allDatasets, auditSectors, runAudit } from "./workspace.jsx";
import { AuditorDraft } from "./AuditorDraft.jsx";
import { CHAT_PHASES, ThinkingIndicator, usePhaseLabel } from "./ThinkingIndicator.jsx";
import {
  getAssistantContext,
  publishAssistantContext,
  summarizeAudit,
  serializeAssistantContext,
  subscribeAssistantContext,
} from "./assistant-context.js";

const SUGGESTIONS = [
  "لخّص لي وضع بياناتي الحالي",
  "ما أهم الملاحظات التي تحتاج مراجعة؟",
  "اشرح لي معنى القيم الشاذة",
];

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("chat"); // chat | draft
  const [curMode, setCurMode] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const endRef = useRef(null);
  const ctx = useSyncExternalStore(subscribeAssistantContext, getAssistantContext, () => null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // ما يفعله المساعد الآن: يتغير النص حسب نوع الطلب ومدة الانتظار
  const waiting = busy && !messages[messages.length - 1]?.content;
  const waitLabel = usePhaseLabel(CHAT_PHASES[curMode] ?? CHAT_PHASES.chat, waiting);
  const lastReply = [...messages].reverse().find((m) => m.role === "assistant" && m.content)?.content;

  // إذا لم تُفتح صفحة التدقيق بعد، نقرأ بياناتك المحفوظة في المتصفح ونحللها بالقواعد الثابتة
  useEffect(() => {
    if (!open || getAssistantContext()?.audit) return;
    try {
      const store = JSON.parse(localStorage.getItem("rasd-audit-store") ?? "null");
      if (!store || typeof store !== "object") return;
      const label = (k) => auditSectors.find((s) => s.key === k)?.label ?? k;
      publishAssistantContext(
        "audit",
        summarizeAudit(store, runAudit(store, Date.now(), {}), allDatasets, label),
      );
    } catch {}
  }, [open]);

  async function send(text, mode = "chat") {
    const content = text.trim().slice(0, 4000);
    if (!content || busy) return;
    const history = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setError("");
    setCurMode(mode);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history.slice(-20),
          context: serializeAssistantContext(ctx),
          mode,
        }),
      });
      if (!res.ok || !res.body) {
        let msg = "تعذّر الحصول على رد.";
        try {
          msg = (await res.json()).error || msg;
        } catch {}
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, content: last.content + chunk };
          return copy;
        });
      }
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "حدث خطأ غير متوقع.");
    } finally {
      setBusy(false);
      abortRef.current = null;
      // نزيل فقاعة المساعد الفارغة عند الفشل أو الإيقاف قبل أي نص
      setMessages((m) =>
        m.length && m[m.length - 1].role === "assistant" && !m[m.length - 1].content
          ? m.slice(0, -1)
          : m,
      );
    }
  }

  return (
    <div className="rasd-ai" dir="rtl">
      {
        <section className="rasd-ai-panel" role="dialog" aria-label="مساعد رصد" hidden={!open}>
          <header className="rasd-ai-head">
            <strong>مساعد رصد</strong>
            <span className="rasd-ai-sub">
              {ctx ? "يرى ملخص بياناتك الحالية" : "لا توجد بيانات مفتوحة بعد"}
            </span>
            <button
              type="button"
              className="rasd-ai-icon"
              aria-label="إغلاق"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <div className="rasd-ai-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={view === "chat"} onClick={() => setView("chat")}>
              المحادثة
            </button>
            <button type="button" role="tab" aria-selected={view === "draft"} onClick={() => setView("draft")}>
              ✎ مسودة مدقق
            </button>
          </div>
          <div className="rasd-ai-body" hidden={view !== "draft"}>
            <AuditorDraft />
          </div>
          <div className="rasd-ai-body" aria-live="polite" hidden={view !== "chat"}>
            <button
              type="button"
              className="rasd-ai-analyze"
              disabled={busy || !ctx}
              title={ctx ? "" : "أدخل أو استورد بيانات أولًا"}
              onClick={() => send("حلّل بياناتي الحالية وأعطني تقريرًا تحليليًا.", "analyze")}
            >
              ✦ حلّل بياناتي بالذكاء الاصطناعي
            </button>
            <button type="button" className="rasd-ai-analyze" onClick={() => setView("draft")}>
              ✎ اكتب مسودة مدقق
            </button>
            {lastReply && !busy && (
              <button
                type="button"
                className="rasd-ai-analyze"
                onClick={() => navigator.clipboard?.writeText(lastReply)}
              >
                نسخ آخر رد
              </button>
            )}
            {messages.length === 0 && (
              <div className="rasd-ai-empty">
                <p>اسألني عن بياناتك، الملاحظات، أو طريقة استخدام رصد.</p>
                <div className="rasd-ai-chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`rasd-ai-msg rasd-ai-${m.role}`}>
                {m.content || (busy && i === messages.length - 1 ? <ThinkingIndicator label={waitLabel} /> : "…")}
                {m.content && busy && i === messages.length - 1 && (
                  <ThinkingIndicator compact label="يكتب الرد…" />
                )}
              </div>
            ))}
            {error && (
              <p className="rasd-ai-error" role="alert">
                {error}
              </p>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="rasd-ai-form"
            hidden={view !== "chat"}
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              rows={1}
              maxLength={4000}
              placeholder="اكتب سؤالك…"
              aria-label="سؤالك"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            {busy ? (
              <button type="button" onClick={() => abortRef.current?.abort()}>
                إيقاف
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()}>
                إرسال
              </button>
            )}
          </form>
          <p className="rasd-ai-note">
            مولَّد بالذكاء الاصطناعي وقد يخطئ؛ راجع النتائج قبل اعتمادها.
          </p>
        </section>
      }
      <button
        type="button"
        className="rasd-ai-fab"
        aria-expanded={open}
        aria-label={open ? "إغلاق المساعد" : "فتح مساعد رصد"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "×" : busy ? <ThinkingIndicator compact label="المساعد يعمل…" /> : "✦ اسأل المساعد"}
      </button>
    </div>
  );
}
