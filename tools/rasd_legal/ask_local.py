"""
سؤال وجواب على التشريعات باستخدام نموذج مستضاف داخلياً (بدون إنترنت).

يعمل مع أي خادم متوافق مع واجهة OpenAI: Ollama أو vLLM أو llama.cpp server أو LM Studio.
مثال مع Ollama:
    ollama pull qwen2.5:14b-instruct          # مرة واحدة على جهاز متصل، ثم انقل النموذج
    python ask_local.py "ما شروط تجزئة الأعمال في العطاءات؟" --model qwen2.5:14b-instruct

المتغيرات: RASD_LLM_URL (الافتراضي http://localhost:11434/v1)  RASD_LLM_MODEL  RASD_LLM_KEY (إن لزم)
"""
import argparse
import json
import os
import re
import urllib.request

from legal_lib import open_db, search, verify_quote, redact, unredact

SYSTEM = """أنت مساعد تدقيق يجيب فقط من نصوص المواد القانونية المرفقة.
القواعد:
1. لا تستعمل أي معلومة من خارج المواد المرفقة. إن لم تجد الجواب فيها قل: «لا يوجد في المصادر المتاحة».
2. لكل حكم تذكره اقتبس النص الحرفي الداعم له بين علامتي « » واذكر بعده [المصدر | رقم المادة].
3. الاقتباس يجب أن يُنسخ حرفياً من المادة دون تغيير أو تلخيص داخل العلامتين.
4. لا تخمّن ولا تعمّم، وإن كان النص غامضاً أو ناقصاً فاذكر ذلك صراحة.
5. أجب بالعربية وبإيجاز."""


def call_llm(messages, model=None, base_url=None, timeout=300):
    base_url = (base_url or os.environ.get("RASD_LLM_URL", "http://localhost:11434/v1")).rstrip("/")
    model = model or os.environ.get("RASD_LLM_MODEL", "qwen2.5:14b-instruct")
    headers = {"Content-Type": "application/json"}
    if os.environ.get("RASD_LLM_KEY"):
        headers["Authorization"] = "Bearer " + os.environ["RASD_LLM_KEY"]
    body = json.dumps({"model": model, "messages": messages, "temperature": 0}).encode()
    req = urllib.request.Request(base_url + "/chat/completions", body, headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())["choices"][0]["message"]["content"]


def build_messages(question, hits):
    ctx = "\n\n".join(
        f"[{h['title']} | المادة {h['article_no']}]\n{h['text']}" for h in hits)
    user = f"المواد المتاحة:\n\n{ctx}\n\nالسؤال: {question}"
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]


def check_quotes(db, answer, hits):
    """يتحقق أن كل اقتباس بين « » موجود حرفياً في إحدى المواد المسترجعة."""
    quotes = re.findall(r"«([^»]{8,})»", answer)
    results = []
    for q in quotes:
        ok = any(verify_quote(db, h["id"], q) for h in hits)
        results.append((q, ok))
    return results


def answer(db, question, k=5, llm=call_llm, mask=True, **llm_kwargs):
    q, mapping = redact(question) if mask else (question, {})
    hits = search(db, q, limit=k)
    if not hits:
        return {"answer": "لا يوجد في المصادر المتاحة.", "sources": [], "quotes": [], "verified": True}
    raw = llm(build_messages(q, hits), **llm_kwargs)
    quotes = check_quotes(db, raw, hits)
    return {
        "answer": unredact(raw, mapping),
        "sources": [{"title": h["title"], "article": h["article_no"], "source": h["source"],
                     "url": h["url"], "fetched_at": h["fetched_at"]} for h in hits],
        "quotes": quotes,
        # الجواب بلا أي اقتباس لا يُعتبر موثّقاً
        "verified": bool(quotes) and all(ok for _, ok in quotes),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("question")
    ap.add_argument("--db", default="legal.db")
    ap.add_argument("--model")
    ap.add_argument("--url")
    ap.add_argument("-k", type=int, default=5)
    a = ap.parse_args()
    res = answer(open_db(a.db), a.question, k=a.k, model=a.model, base_url=a.url)
    print(res["answer"])
    print("\n--- التحقق ---")
    for q, ok in res["quotes"]:
        print(("✔ " if ok else "✘ غير موجود حرفياً في المصادر: ") + q[:80])
    if not res["quotes"]:
        print("⚠ الجواب بلا اقتباسات، لا تعتمد عليه قبل المراجعة.")
    elif not res["verified"]:
        print("⚠ يوجد اقتباس غير مطابق، لا تعتمد على الجواب قبل مراجعة النص الأصلي.")
    print("\n--- المصادر ---")
    for s in res["sources"]:
        print(f"- {s['source']} | {s['title']} | المادة {s['article']} | سُحب: {s['fetched_at']}")


if __name__ == "__main__":
    main()
