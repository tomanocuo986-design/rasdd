import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { allDatasets, auditSectors, runAudit } from "./workspace.jsx";
import { AuditorDraft } from "./AuditorDraft.jsx";
import { DraftCard } from "./DraftCard.jsx";
import { isObservationText } from "./chat-draft.js";
import { listRegulations } from "./regulations-db.js";
import { buildQuery, retrievePassages, toPayload } from "./legal-retrieval.js";
import { makeToolbox } from "./agent-wiring.js";
import { runAgent } from "./agent-loop.js";
import { CHAT_PHASES, ThinkingIndicator, usePhaseLabel } from "./ThinkingIndicator.jsx";
import {
  getAssistantContext,
  publishAssistantContext,
  summarizeAudit,
  serializeAssistantContext,
  subscribeAssistantContext,
} from "./assistant-context.js";

const DRAFT_NOTE =
  "حوّلتُ وصفك إلى مسودة ملاحظة رقابية (الحالة، السند القانوني، السبب، الأثر، التوصية) مع تصنيفها. هي بانتظار قرارك: اعتماد أو تعديل أو حذف، ولا تدخل التقرير قبل الاعتماد.";

const SUGGESTIONS = [
  "لخّص لي وضع بياناتي الحالي",
  "ما أهم الملاحظات التي تحتاج مراجعة؟",
  "اشرح لي معنى القيم الشاذة",
];

const AI_PRIVACY = {
  local: "🔒 نموذج داخل شبكة الجهة: بيانات المحادثة لا تغادر الشبكة.",
  external: "⚠ نموذج خارجي مُفعَّل بقرار إداري: تُحجب الأرقام الوطنية والهواتف والحسابات والأسماء بألقاب قبل الإرسال، وغير ذلك قد يصل المزود.",
  "external-blocked": "⛔ المزود الخارجي غير مسموح افتراضيًا لحماية سرية بيانات التدقيق. اطلب من مدير النظام ضبط نموذج محلي (LLM_BASE_URL).",
};

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("chat"); // chat | draft
  const [curMode, setCurMode] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agentOn, setAgentOn] = useState(() => {
    try {
      return localStorage.getItem("rasd-agent-mode") !== "off";
    } catch {
      return true;
    }
  });
  const [approval, setApproval] = useState(null); // { description, resolve }
  const [aiStatus, setAiStatus] = useState(""); // off | local | external-blocked | external (من /api/health)
  const abortRef = useRef(null);
  const endRef = useRef(null);
  const ctx = useSyncExternalStore(subscribeAssistantContext, getAssistantContext, () => null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, open]);

  // مؤشر الخصوصية: أين تذهب بيانات المحادثة (داخل الشبكة أم مزود خارجي). لا يؤثر على عمل المساعد إن فشل الطلب.
  useEffect(() => {
    if (!open || aiStatus || typeof fetch !== "function") return;
    let live = true;
    Promise.resolve()
      .then(() => fetch("/api/health"))
      .then((r) => r?.json?.())
      .then((d) => live && typeof d?.ai === "string" && setAiStatus(d.ai))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, aiStatus]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const toggleAgent = (on) => {
    setAgentOn(on);
    try {
      localStorage.setItem("rasd-agent-mode", on ? "on" : "off");
    } catch {}
  };

  // نص يُلحق بآخر رد، وخطوات أدوات تُحدَّث حسب المعرّف
  const patchLast = (fn) =>
    setMessages((m) => {
      const copy = m.slice();
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });

  async function sendAgent(content, history, passages, controller) {
    const toolbox = makeToolbox();
    const callStep = async ({ messages, step }) => {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages,
          step,
          context: serializeAssistantContext(ctx),
          passages: passages.length ? passages : undefined,
        }),
      });
      if (!res.ok) {
        let msg = "تعذّر الحصول على رد.";
        try {
          msg = (await res.json()).error || msg;
        } catch {}
        throw new Error(msg);
      }
      return res.json();
    };
    const approve = (call, description) =>
      new Promise((resolve) => {
        controller.signal.addEventListener("abort", () => resolve(false), { once: true });
        setApproval({ description, resolve });
      }).finally(() => setApproval(null));
    const onEvent = (ev) => {
      if (ev.type === "text") patchLast((l) => ({ ...l, content: ev.text }));
      else if (ev.type === "tool")
        patchLast((l) => {
          const tools = (l.tools ?? []).slice();
          const i = tools.findIndex((t) => t.id === ev.id);
          const next = { id: ev.id, name: ev.name, status: ev.status, description: ev.description };
          if (i >= 0) tools[i] = next;
          else tools.push(next);
          return { ...l, tools };
        });
    };
    await runAgent({ history, callStep, toolbox, approve, onEvent, signal: controller.signal });
  }

  // ما يفعله المساعد الآن: يتغير النص حسب نوع الطلب ومدة الانتظار
  const waiting = busy && !messages[messages.length - 1]?.content;
  const waitLabel = usePhaseLabel(CHAT_PHASES[curMode] ?? CHAT_PHASES.chat, waiting);
  const lastReply = [...messages].reverse().find((m) => m.role === "assistant" && m.content && !m.draftFor)?.content;

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
    // وصف ملاحظة رقابية (صياغة صريحة أو عبارة «لوحظ…»): تُقارَن بالتقارير السابقة وتُصاغ محليًا وتنتظر قرار المدقق
    if (mode === "chat" && isObservationText(content)) {
      setMessages([...history, { role: "assistant", content: DRAFT_NOTE, draftFor: content }]);
      setInput("");
      setError("");
      return;
    }
    // RAG: نجلب مقاطع الأنظمة ذات الصلة من مكتبة المدقق (إن وُجدت) قبل الإرسال
    let passages = [];
    try {
      const docs = await listRegulations();
      if (docs?.length) {
        passages = toPayload(
          retrievePassages(docs, buildQuery(content, ctx, mode), { k: mode === "chat" ? 4 : 6 }),
        );
      }
    } catch {}
    setMessages([...history, { role: "assistant", content: "", sources: passages.map((p) => p.source) }]);
    setInput("");
    setError("");
    setCurMode(mode);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (agentOn && mode === "chat") {
        await sendAgent(content, history, passages, controller);
        return;
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history.slice(-20),
          context: serializeAssistantContext(ctx),
          passages: passages.length ? passages : undefined,
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
            <label className="rasd-ai-agent-toggle">
              <input type="checkbox" checked={agentOn} onChange={(e) => toggleAgent(e.target.checked)} />
              وضع الوكيل: يستخدم أدوات للبحث في ملاحظاتك ومكتبة الأنظمة
            </label>
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
              <div key={i} className={`rasd-ai-msg rasd-ai-${m.role}${m.draftFor ? " rasd-ai-msg-draft" : ""}`}>
                {m.tools?.length > 0 && (
                  <ul className="rasd-ai-tools" aria-label="خطوات الوكيل">
                    {m.tools.map((t) => (
                      <li key={t.id} className="rasd-ai-tool" data-status={t.status}>
                        <span aria-hidden>
                          {{ running: "⏳", awaiting: "✋", done: "✓", error: "⚠", denied: "✗" }[t.status] ?? "•"}
                        </span>
                        <span>{t.description}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {m.content || (busy && i === messages.length - 1 ? <ThinkingIndicator label={waitLabel} /> : "…")}
                {m.content && busy && i === messages.length - 1 && (
                  <ThinkingIndicator compact label="يكتب الرد…" />
                )}
                {m.draftFor && <DraftCard source={m.draftFor} />}
                {m.role === "assistant" && m.content && m.sources?.length > 0 && (
                  <details className="rasd-ai-sources">
                    <summary>مصادر من مكتبة الأنظمة ({m.sources.length})</summary>
                    <ul>
                      {m.sources.map((src, j) => (
                        <li key={j}>{src}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
            {approval && (
              <div className="rasd-ai-approve" role="alertdialog" aria-label="طلب موافقة">
                <strong>يطلب الوكيل تنفيذ إجراء يغيّر سجلك:</strong>
                <span>{approval.description}</span>
                <div className="rasd-ai-approve-actions">
                  <button type="button" data-primary onClick={() => approval.resolve(true)}>
                    موافقة
                  </button>
                  <button type="button" onClick={() => approval.resolve(false)}>
                    رفض
                  </button>
                </div>
              </div>
            )}
            {AI_PRIVACY[aiStatus] && (
              <p className="rasd-ai-privacy" data-testid="ai-privacy" data-level={aiStatus}>
                {AI_PRIVACY[aiStatus]}
              </p>
            )}
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
