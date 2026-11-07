// حلقة الوكيل في المتصفح: تطلب من الخادم خطوة، تنفّذ الأدوات المطلوبة محليًا، تعيد النتائج، وتكرر حتى الإجابة النهائية.
// الإجراءات الكاتبة تمرّ عبر approve() ولا تُنفَّذ إلا بموافقة صريحة؛ الرفض يُعاد للنموذج كنتيجة.

export const MAX_STEPS = 8;
const WRITE_TOOLS = new Set(["record_review_decision"]);
export const isWriteTool = (name) => WRITE_TOOLS.has(name);

/** يحوّل محادثة الواجهة (نصوص فقط) إلى رسائل الوكيل. */
export const toAgentMessages = (history) =>
  history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({ role: m.role, content: m.content }));

/**
 * @param {object} o
 * @param {{role:string,content:string}[]} o.history   المحادثة السابقة + سؤال المستخدم الأخير
 * @param {(req:{messages:any[], step:number}) => Promise<{text:string, toolCalls:any[]}>} o.callStep
 * @param {{run:(n:string,a:object)=>Promise<string>, describe:(n:string,a:object)=>string}} o.toolbox
 * @param {(call:{id:string,name:string,args:object}, description:string) => Promise<boolean>} o.approve
 * @param {(ev:object) => void} o.onEvent   {type:"tool", id, name, status, description?} | {type:"text", text} | {type:"limit"}
 * @param {AbortSignal} [o.signal]
 */
export async function runAgent({ history, callStep, toolbox, approve, onEvent, signal, maxSteps = MAX_STEPS }) {
  const messages = toAgentMessages(history);
  for (let step = 1; step <= maxSteps; step++) {
    if (signal?.aborted) return { stopped: true };
    const out = await callStep({ messages, step });
    if (!out.toolCalls?.length) {
      onEvent({ type: "text", text: out.text });
      return { text: out.text, steps: step };
    }
    messages.push({ role: "assistant", content: out.text ?? "", toolCalls: out.toolCalls });
    for (const call of out.toolCalls) {
      if (signal?.aborted) return { stopped: true };
      const description = toolbox.describe(call.name, call.args);
      let result;
      if (isWriteTool(call.name)) {
        onEvent({ type: "tool", id: call.id, name: call.name, status: "awaiting", description });
        const ok = await approve(call, description);
        if (!ok) {
          result = JSON.stringify({ denied: true, message: "رفض المدقق تنفيذ هذا الإجراء. لا تعد المحاولة." });
          onEvent({ type: "tool", id: call.id, name: call.name, status: "denied", description });
        } else {
          result = await toolbox.run(call.name, call.args);
          onEvent({ type: "tool", id: call.id, name: call.name, status: "done", description });
        }
      } else {
        onEvent({ type: "tool", id: call.id, name: call.name, status: "running", description });
        result = await toolbox.run(call.name, call.args);
        const failed = /^\{"error"/.test(result);
        onEvent({ type: "tool", id: call.id, name: call.name, status: failed ? "error" : "done", description });
      }
      messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: result });
    }
  }
  // استنفد الحد: نطلب خلاصة بلا أدوات بدل ترك المستخدم بلا جواب
  onEvent({ type: "limit" });
  messages.push({
    role: "user",
    content: "بلغت الحد الأقصى من الخطوات. لخّص الآن ما توصلت إليه من نتائج الأدوات فقط، وانصح بما ينقص، دون استدعاء أدوات.",
  });
  const last = await callStep({ messages, step: maxSteps });
  onEvent({ type: "text", text: last.text || "تعذّر إكمال المهمة ضمن حد الخطوات." });
  return { text: last.text, steps: maxSteps + 1, limited: true };
}
