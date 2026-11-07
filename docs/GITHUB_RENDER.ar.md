# الرفع على GitHub ثم Render

## 1) من الترمنال إلى GitHub (يحافظ على تاريخ المستودع)
```bash
unzip rasdd-final_4.zip
cd rasdd-main
git init
git branch -M main
git remote add origin https://github.com/tomanocuo986-design/rasdd.git
git fetch origin
git reset --soft origin/main      # يأخذ تاريخ المستودع الحالي ويبقي ملفاتك الجديدة كما هي
git add -A
git commit -m "وضع العرض التجريبي + التخزين المستدام"
git push -u origin main
```
- إن كان المستودع على GitHub **فارغًا** (لا فرع main) فتجاوز الأمرين `git fetch` و`git reset` وأكمل بقية الأوامر.
- بديل أبسط يستبدل كل ما في `main` (يمحو تاريخه): `git push -u origin main --force`.
- عند طلب كلمة المرور استخدم **Personal Access Token** (GitHub ← Settings ← Developer settings ← Tokens، صلاحية `repo`) وليس كلمة مرور الحساب.
- للتحديثات لاحقًا: `git add -A && git commit -m "وصف" && git push`.

## 2) النشر على Render
1. dashboard.render.com ← **New +** ← **Blueprint** ← اختر مستودع `rasdd` (يقرأ `render.yaml` تلقائيًا).
2. عند الطلب أدخل `GEMINI_API_KEY` (من aistudio.google.com/apikey). بدونه يعمل التطبيق و«مسودة المدقق» والعرض التجريبي، لكن دردشة المساعد تظهر «غير مفعّل».
3. اضغط **Apply** وانتظر البناء (3–6 دقائق). الرابط يظهر أعلى صفحة الخدمة.
4. أي `git push` لاحق ينشر تلقائيًا.

بديل يدوي: New + ← Web Service ← المستودع، Runtime: Node، Build: `npm install --legacy-peer-deps && NITRO_PRESET=node-server npx vite build`، Start: `node start.mjs`، ومتغير `NODE_VERSION=22`.

## 3) رابط العرض التجريبي
بعد النشر شارك: `https://اسم-خدمتك.onrender.com/?demo=1` — يفتح مباشرة على لوحة التدقيق وقد امتلأت بالبيانات الافتراضية وظهرت الانحرافات (يعمل فقط لزائر منصته فارغة).

## ملاحظات
- الخطة المجانية تنام بعد ~15 دقيقة خمول؛ أول فتح بعدها يأخذ نصف دقيقة تقريبًا.
- بيانات رصد (التقارير السابقة ونتائج التدقيق) محفوظة في **متصفح** كل مستخدم: في localStorage ونسخة مستدامة في IndexedDB تعود تلقائيًا في الجلسات القادمة. هي لا تنتقل بين الأجهزة تلقائيًا؛ لذلك استعمل النسخ الاحتياطي أو فعّل قاعدة البيانات المركزية (`docs/DEPLOYMENT.ar.md`).
