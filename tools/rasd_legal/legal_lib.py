"""
مكتبة التشريعات لمشروع «رصد»
سحب -> استخراج نص -> فحص جودة -> تقسيم حسب المادة -> تخزين بإصدارات -> بحث -> تحقق من الاقتباس -> إخفاء

هذه المكتبة تتعامل مع التشريعات العامة فقط. لا تضع بيانات تدقيق سرية في هذه القاعدة.
"""
import hashlib
import io
import os
import re
import sqlite3
import time
import unicodedata
import urllib.robotparser
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin

# ---------- تطبيع النص العربي ----------
_TASHKEEL = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def normalize_ar(text: str) -> str:
    """للبحث والمطابقة: إزالة التشكيل والتطويل، توحيد الألف والياء والتاء المربوطة والأرقام."""
    text = _TASHKEEL.sub("", text)
    text = re.sub("[إأآٱ]", "ا", text)
    text = text.replace("ى", "ي").replace("ة", "ه")
    text = text.translate(_AR_DIGITS)
    return re.sub(r"\s+", " ", text).strip()


def clean_extracted(text: str) -> str:
    """تنظيف مخرجات PDF القديمة: أشكال العرض العربية -> حروف أساسية، حذف رموز دخيلة وتطويل."""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[\u0400-\u04FF\uE000-\uF8FF\uFFFD\u200B-\u200F\u202A-\u202E]", "", text)
    text = text.replace("\u0640", "")
    return text


# ---------- فحص جودة النص المستخرج ----------
_FUNC = {"من", "في", "على", "الى", "إلى", "ان", "أن", "او", "أو", "هذا", "هذه", "التي", "الذي", "ما", "عن",
         "كل", "مع", "وفق", "وفقا", "المادة", "لا", "يتم", "كان", "او"}


def text_quality(text: str):
    """يرجع (درجة 0..1, أعلام). أي علم يعني أن النص غير موثوق ويحتاج مراجعة أو OCR."""
    toks = re.findall(r"[\u0621-\u064A]+", text)
    if len(toks) < 30:
        return 0.0, ["too_short"]
    flags = []
    func = sum(t in _FUNC for t in toks) / len(toks)
    ya_start = sum(t.startswith("ى") and len(t) > 1 for t in toks) / len(toks)  # ى بداية كلمة = ه مشوّهة (ىذه/ىو)
    garbled = sum(t.startswith("ة") or "ةة" in t for t in toks) / len(toks)  # كلمة تبدأ بـ ة أو فيها ةة = خط مشوّه
    if garbled > 0.005:
        flags.append("garbled_letters")
    if func < 0.04:
        flags.append("low_function_words")  # نص عربي سليم تتجاوز فيه الكلمات الوظيفية ~8%
    if ya_start > 0.005:
        flags.append("ya_for_ha")
    score = max(0.0, min(1.0, func / 0.10)) * (0.5 if flags else 1.0)
    return round(score, 2), flags


# ---------- السحب ----------
UA = "RasdLegalBot/1.0 (audit-court research; contact: set-your-email@example.gov)"
_robots = {}


def allowed_by_robots(url: str) -> bool:
    p = urlparse(url)
    base = f"{p.scheme}://{p.netloc}"
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            rp.set_url(base + "/robots.txt")
            rp.read()
        except Exception:
            rp = None
        _robots[base] = rp
    rp = _robots[base]
    return True if rp is None else rp.can_fetch(UA, url)


def fetch(url: str, delay: float = 2.0, timeout: int = 40):
    """يرجع (bytes, content_type). يحترم robots.txt ويؤخر الطلبات."""
    import requests

    if not allowed_by_robots(url):
        raise PermissionError(f"robots.txt يمنع السحب: {url}")
    time.sleep(delay)
    r = requests.get(url, headers={"User-Agent": UA}, timeout=timeout)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "")


def extract_links(html: bytes, base_url: str, exts=(".pdf",)):
    """روابط الملفات (PDF افتراضياً) من صفحة قائمة."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    out = []
    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"])
        if href.lower().split("?")[0].endswith(exts):
            out.append((a.get_text(strip=True) or href, href))
    return out


_LEG_WORDS = ("التشريعات", "القوانين", "الأنظمة", "الانظمة", "التعليمات", "الأسس", "الاسس")


def discover_list_pages(html: bytes, base_url: str):
    """من الصفحة الرئيسية: يجد صفحات القوائم (/List/) التي عنوانها يتعلق بالتشريعات. الأرشفة مستبعدة عمداً."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    found = {}
    for a in soup.find_all("a", href=True):
        label = a.get_text(strip=True)
        href = urljoin(base_url, a["href"])
        if "/list/" in href.lower() and any(w in label for w in _LEG_WORDS) and "ارشف" not in label:
            found[href] = label
    return found


def ocr_pdf(content: bytes) -> str:
    """OCR عربي لملفات PDF الممسوحة أو ذات الخطوط المشوّهة. يحتاج: pdf2image + pytesseract + tesseract-ocr-ara."""
    try:
        from pdf2image import convert_from_bytes
        import pytesseract
    except ImportError as e:
        raise RuntimeError("OCR غير مثبّت: pip install pdf2image pytesseract + حزمة tesseract-ocr-ara") from e
    pages = convert_from_bytes(content, dpi=220)
    return "\n".join(pytesseract.image_to_string(p, lang="ara") for p in pages)


def extract_text(content: bytes, content_type: str, url: str, ocr_if_bad: bool = None):
    """يرجع (نص_منظّف, أعلام). إذا النص رديء و OCR مفعّل (RASD_OCR=1) يجرّب OCR ويختار الأفضل."""
    if ocr_if_bad is None:
        ocr_if_bad = os.environ.get("RASD_OCR") == "1"
    flags = []
    if "pdf" in content_type.lower() or url.lower().endswith(".pdf"):
        import pdfplumber

        with pdfplumber.open(io.BytesIO(content)) as pdf:
            raw = "\n".join((p.extract_text() or "") for p in pdf.pages)
        weird = len(re.findall(r"[\u0400-\u04FF\uE000-\uF8FF\uFFFD]", raw))
        if weird > 20:
            flags.append("foreign_glyphs")  # خط قديم: حروف دخيلة بدل الحروف العربية
        text = clean_extracted(raw)
        score, qflags = text_quality(text)
        flags += qflags
        if (qflags or weird > 20) and ocr_if_bad:
            try:
                ocr_text = clean_extracted(ocr_pdf(content))
                oscore, oflags = text_quality(ocr_text)
                if oscore > score:
                    return ocr_text, ["ocr_used"] + oflags
            except Exception as e:
                flags.append(f"ocr_failed:{type(e).__name__}")
        return text, flags
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(content, "html.parser")
    for t in soup(["script", "style", "nav", "footer", "header"]):
        t.decompose()
    return clean_extracted(soup.get_text("\n")), flags


# ---------- التقسيم حسب المادة ----------
# الصيغة العادية: "المادة 12" في بداية السطر
_ART_NORMAL = re.compile(
    r"^[ \t]*(?:المادة|مادة)[ \t]*[\(\[]?[ \t]*([0-9٠-٩]+)[ \t]*[\)\]]?[ \t]*[:\-–.]?", re.M)
# الصيغة المعكوسة (شائعة في PDF الحكومية القديمة): "... نص - ١المادة" أي الرقم قبل الكلمة وفي آخر سطر
_ART_REV = re.compile(
    r"(?<![\(\[0-9٠-٩])[-–]?[ \t]*(?:[أ-ي][ \t]*-[ \t]*)?([0-9٠-٩]{1,3})[ \t]*(?:المادة|مادة)", re.M)


def split_articles(text: str):
    """يرجع [(رقم_المادة, النص)]. يختار الصيغة العادية أو المعكوسة حسب الأكثر مطابقة. إن لم يجد: قطعة واحدة '0'."""
    normal = list(_ART_NORMAL.finditer(text))
    rev = list(_ART_REV.finditer(text))
    if len(rev) > len(normal) and len(rev) >= 2:
        # بداية المادة = بداية السطر الذي يحوي العلامة
        marks = [(text.rfind("\n", 0, m.start()) + 1, m.group(1)) for m in rev]
    elif len(normal) >= 1:
        marks = [(m.start(), m.group(1)) for m in normal]
    else:
        return [("0", text.strip())] if text.strip() else []
    out = []
    pre = text[: marks[0][0]].strip()
    if pre:
        out.append(("0", pre))  # العنوان/الديباجة
    for i, (start, no) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        out.append((no.translate(_AR_DIGITS), text[start:end].strip()))
    return out


# ---------- التخزين بإصدارات ----------
SCHEMA = """
CREATE TABLE IF NOT EXISTS documents(
  id INTEGER PRIMARY KEY, source TEXT, title TEXT, url TEXT,
  sha256 TEXT, fetched_at TEXT, is_current INTEGER DEFAULT 1,
  quality REAL, quality_flags TEXT, needs_review INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS articles(
  id INTEGER PRIMARY KEY, doc_id INTEGER REFERENCES documents(id),
  article_no TEXT, text TEXT, text_norm TEXT);
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  text_norm, content='articles', content_rowid='id');
CREATE INDEX IF NOT EXISTS idx_doc_url ON documents(url, is_current);
"""


def open_db(path="legal.db"):
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)
    return db


def store_document(db, source, title, url, text, raw_bytes=None, flags=()):
    """يخزّن الوثيقة بإصدار. إذا تغيّرت البصمة يحتفظ بالقديمة (is_current=0) ويضيف جديدة.
    الوثائق ذات الجودة الرديئة تُخزَّن لكن بعلم needs_review=1 ولا يجوز الاعتماد عليها قبل المراجعة.
    يرجع 'new' | 'updated' | 'unchanged'."""
    sha = hashlib.sha256(raw_bytes if raw_bytes is not None else text.encode()).hexdigest()
    cur = db.execute("SELECT id, sha256 FROM documents WHERE url=? AND is_current=1", (url,)).fetchone()
    if cur and cur["sha256"] == sha:
        return "unchanged"
    status = "new"
    if cur:
        db.execute("UPDATE documents SET is_current=0 WHERE id=?", (cur["id"],))
        status = "updated"
    score, qflags = text_quality(text)
    all_flags = sorted(set(list(flags) + qflags))
    bad = {"low_function_words", "ya_for_ha", "garbled_letters", "foreign_glyphs", "too_short"}
    needs_review = int(bool(bad & set(all_flags)) and "ocr_used" not in all_flags)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    doc_id = db.execute(
        "INSERT INTO documents(source,title,url,sha256,fetched_at,quality,quality_flags,needs_review) "
        "VALUES(?,?,?,?,?,?,?,?)",
        (source, title, url, sha, now, score, ",".join(all_flags), needs_review),
    ).lastrowid
    for no, body in split_articles(text):
        norm = normalize_ar(body)
        rid = db.execute(
            "INSERT INTO articles(doc_id,article_no,text,text_norm) VALUES(?,?,?,?)",
            (doc_id, no, body, norm),
        ).lastrowid
        db.execute("INSERT INTO articles_fts(rowid,text_norm) VALUES(?,?)", (rid, norm))
    db.commit()
    return status


# ---------- البحث ----------
def search(db, query: str, limit: int = 5, current_only: bool = True, include_unreviewed: bool = False):
    """بحث في المواد. الوثائق المعلّمة needs_review مستبعدة افتراضياً."""
    words = [w for w in normalize_ar(query).split() if len(w) > 1]
    if not words:
        return []
    q = " OR ".join(f'"{w}"' for w in words)
    where = []
    if current_only:
        where.append("d.is_current=1")
    if not include_unreviewed:
        where.append("d.needs_review=0")
    sql = f"""
      SELECT a.id, a.article_no, a.text, d.source, d.title, d.url, d.fetched_at, d.needs_review
      FROM articles_fts f JOIN articles a ON a.id=f.rowid JOIN documents d ON d.id=a.doc_id
      WHERE articles_fts MATCH ? {'AND ' + ' AND '.join(where) if where else ''}
      ORDER BY bm25(articles_fts) LIMIT ?"""
    return [dict(r) for r in db.execute(sql, (q, limit))]


def documents_needing_review(db):
    return [dict(r) for r in db.execute(
        "SELECT source,title,url,quality,quality_flags FROM documents WHERE needs_review=1 AND is_current=1")]


# ---------- التحقق من الاقتباس ----------
def verify_quote(db, article_id: int, quote: str) -> bool:
    row = db.execute("SELECT text_norm FROM articles WHERE id=?", (article_id,)).fetchone()
    return bool(row) and normalize_ar(quote) in row["text_norm"]


# ---------- إخفاء البيانات الحساسة ----------
_PATTERNS = [
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")),
    ("PHONE", re.compile(r"(?<!\d)(?:\+?962|0)?7[789]\d{7}(?!\d)")),
    ("NATID", re.compile(r"(?<!\d)\d{10}(?!\d)")),
    ("AMOUNT", re.compile(r"\d[\d,\.]*\s*(?:دينار|د\.أ|JD|JOD)")),
]


def redact(text: str):
    mapping, counter = {}, {}

    def sub(label):
        def _r(m):
            counter[label] = counter.get(label, 0) + 1
            tok = f"[{label}_{counter[label]}]"
            mapping[tok] = m.group(0)
            return tok
        return _r

    text = text.translate(_AR_DIGITS)
    for label, pat in _PATTERNS:
        text = pat.sub(sub(label), text)
    return text, mapping


def unredact(text: str, mapping: dict) -> str:
    for tok, val in mapping.items():
        text = text.replace(tok, val)
    return text
