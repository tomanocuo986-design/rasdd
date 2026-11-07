# تنظيم كود الواجهة (`src/rasd`)

| الملف | المحتوى |
|---|---|
| `workspace.jsx` | `Workspace` (الشاشة الرئيسية) + التنقل + إعادة التصدير |
| `SectorAudit.jsx` | شاشة تدقيق نشاط واحد |
| `audit-engine.js` | محرك التدقيق (مرجع) |
| `audit-support.js` | تحميل/حفظ التقارير، تسميات الخطورة، حقول المعاملات |
| `report-export.jsx` | تصدير PDF/Word وتشكيل العربية |
| `regulation-match.js` | تقطيع الأنظمة والمطابقة |
| `i18n.js` | اللغات والنصوص |
| `ui-primitives.jsx` | Button وDialog وSwitch |
| `official-library.ts` | مزامنة المكتبة الرسمية (TypeScript صارم) |

قاعدة الاعتماد: لا استيراد دائري. `workspace` ← `SectorAudit` ← (`report-export` ← `audit-support`) و`regulation-match` و`ui-primitives`.
`workspace.jsx` و`SectorAudit.jsx` و`report-export.jsx` و`ui-primitives.jsx` ما زالت `@ts-nocheck` لأنها ناتج تجميع؛ قاعدة الفريق: أي ملف جديد يُكتب بـ TypeScript ويدخل `lint:strict`.
الفحص قبل الدمج: `npm run check`.
