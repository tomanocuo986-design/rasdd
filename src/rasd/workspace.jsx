// @ts-nocheck
/* eslint-disable */
import { trackEvent } from "./audit-trail.js";
import * as import_react from "react";
import * as import_jsx_runtime from "react/jsx-runtime";
import {
  Check, ArrowLeft, Bell, Activity, CircleHelp as CircleQuestionMark, BookOpen, FileText,
  SlidersHorizontal, FileChartColumn, Settings2, Radar, Plus, Globe, History, Sun, Search,
  LayoutGrid, Upload, ShieldCheck, Moon, Trash2, ShieldAlert, X, Save, FileSpreadsheet,
  Building2, Download, FileDown,
} from "lucide-react";
import { clsx } from "clsx";
import { cva } from "class-variance-authority";
import { Line, Tooltip, Area, YAxis, CartesianGrid, XAxis, ResponsiveContainer, ComposedChart } from "recharts";
import {
  Overlay as DialogOverlay$1, Description as DialogDescription$1, Close as DialogClose,
  Portal as DialogPortal$1, Content as DialogContent$1, Title as DialogTitle$1, Root as Dialog$1,
} from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import Papa from "papaparse";
import { twMerge } from "tailwind-merge";
import { Thumb as SwitchThumb, Root as Switch$1 } from "@radix-ui/react-switch";
import { quantileSorted } from "simple-statistics";
import radarImg from "@/assets/radar-sculpture.jpg";
import { extractPdfRows } from "./pdf-rows";
import { mapSheets, mapWorkbook } from "./import-table";
import { jsonToSheets, rowsFromAoaChunked, xmlToSheets } from "./import-formats.js";
import { parseDateMs } from "./dates";
import {
  listRegulations,
  saveRegulation,
  deleteRegulation,
  updateRegulationMeta,
} from "./regulations-db";
import { extractPdfPages, extractPdfText } from "./pdf-text";
import { isGarbled, repairArabic } from "./arabic-text.js";
import BackupPanel from "./BackupPanel";
import { AdvancedPanel, sodFindings, fraudFindings, complianceOf, valueKeyOf } from "./advanced";
import { advancedFindings } from "./advanced-queries";
import { legalFrameworkOf, legalTextOf } from "./legal-framework";
import { calibrateSeverity, impactAmount, defaultCalibration, loadCalibration, saveCalibration, CALIBRATION_PROFILES, calibrationFields, applyProfile } from "./severity";
import { buildHistoryIndex, classifyFindings, resolvedFindings, historySummary, findingsFromRows, reportFromJson, extractRecommendations, STATUS_LABEL } from "./history";
import { partitionRecords, rejectionMessage, rejectedToCsv, missingRequired } from "./validation";
import {
  currentObservations,
  draftObservations,
  loadIds,
  observationLines,
  saveDraft,
  saveIds,
  summarize,
  summaryText,
} from "./observations";
import { AuditReport } from "./AuditReport";
import { ObservationsPanel } from "./ObservationsPanel";
import { ReviewStatsPanel } from "./ReviewStatsPanel";
import { LegalCoveragePanel } from "./LegalCoveragePanel";
import { LibraryMeta } from "./LibraryMeta";
import { linkedRegulation, loadLinks, saveLinks } from "./legal-status";
import {
  decisionFor,
  loadReviewLog,
  loadThreshold,
  observationFingerprint,
  recordDecision,
  saveReviewLog,
  saveThreshold,
  staleHiddenIds,
} from "./review-log.js";
import { ExecutiveDashboard } from "./dashboard";
import { RejectedAlert, CalibrationPanel } from "./panels";
import { publishAssistantContext, summarizeAudit } from "./assistant-context.js";
import { useManualObservations } from "./manual-observations";
import { mergeSeedReports, markSeedRemoved } from "./seed-reports.js";
import { DemoBar } from "./DemoBar.jsx";
import { buildDemoPreviousReport, buildDemoStore, DEMO_FLAG_KEY, DEMO_PARAMS, DEMO_SNAPSHOT_KEY } from "./demo-data.js";
const import_papaparse = { default: Papa };
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
var buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        ink: "bg-ink text-on-ink hover:bg-ink/85 shadow-sm",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
var Button = import_react.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      asChild ? Slot : "button",
      {
        className: cn(
          buttonVariants({
            variant,
            size,
            className,
          }),
        ),
        ref,
        ...props,
      },
    );
  },
);
Button.displayName = "Button";
var Dialog = Dialog$1;
var DialogPortal = DialogPortal$1;
var DialogOverlay = import_react.forwardRef(({ className, ...props }, ref) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
    ref,
    className: cn(
      "fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    ),
    ...props,
  }),
);
DialogOverlay.displayName = DialogOverlay$1.displayName;
var DialogContent = import_react.forwardRef(
  ({ className, children, ...props }, ref) =>
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, {
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
          ref,
          className: cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
            className,
          ),
          ...props,
          children: [
            children,
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
              className:
                "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
                  className: "h-4 w-4",
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                  className: "sr-only",
                  children: "Close",
                }),
              ],
            }),
          ],
        }),
      ],
    }),
);
DialogContent.displayName = DialogContent$1.displayName;
var DialogHeader = ({ className, ...props }) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    ),
    ...props,
  });
DialogHeader.displayName = "DialogHeader";
var DialogFooter = ({ className, ...props }) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    ),
    ...props,
  });
DialogFooter.displayName = "DialogFooter";
var DialogTitle = import_react.forwardRef(({ className, ...props }, ref) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
    ref,
    className: cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    ),
    ...props,
  }),
);
DialogTitle.displayName = DialogTitle$1.displayName;
var DialogDescription = import_react.forwardRef(
  ({ className, ...props }, ref) =>
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
      ref,
      className: cn("text-sm text-muted-foreground", className),
      ...props,
    }),
);
DialogDescription.displayName = DialogDescription$1.displayName;
var Switch = import_react.forwardRef(({ className, ...props }, ref) =>
  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
    className: cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    ),
    ...props,
    ref,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, {
      className: cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 rtl:data-[state=checked]:-translate-x-4 data-[state=unchecked]:translate-x-0",
      ),
    }),
  }),
);
Switch.displayName = Switch$1.displayName;
function analyzeEntries(entries, rules) {
  const findings = [];
  const seen = /* @__PURE__ */ new Set();
  const bounds = /* @__PURE__ */ new Map();
  if (rules.outliers && Number(rules.sensitivity) > 0)
    for (const sector of new Set(entries.map((e) => e.sector))) {
      const values = entries
        .filter((e) => e.sector === sector)
        .map((e) => e.value)
        .sort((a, b) => a - b);
      if (values.length >= 4) {
        const q1 = quantileSorted(values, 0.25),
          q3 = quantileSorted(values, 0.75);
        if (q3 > q1)
          bounds.set(sector, q3 + Number(rules.sensitivity) * (q3 - q1));
      }
    }
  for (const entry of entries) {
    if (rules.limits && entry.value > entry.limit)
      findings.push({
        id: entry.id + "-limit",
        entry,
        kind: "limit",
        severity: "high",
      });
    else if (
      rules.outliers &&
      entry.value > (bounds.get(entry.sector) ?? Infinity)
    )
      findings.push({
        id: entry.id + "-outlier",
        entry,
        kind: "outlier",
        severity: "medium",
      });
    const signature = JSON.stringify([
      entry.sector,
      entry.label.trim(),
      entry.value,
      entry.date,
    ]);
    if (rules.duplicates && seen.has(signature))
      findings.push({
        id: entry.id + "-duplicate",
        entry,
        kind: "duplicate",
        severity: "medium",
      });
    seen.add(signature);
  }
  return findings;
}
var languages = [
  ["ar", "العربية"],
  ["en", "English"],
  ["fr", "Français"],
  ["es", "Español"],
  ["de", "Deutsch"],
  ["tr", "Türkçe"],
  ["pt", "Português"],
  ["ru", "Русский"],
  ["zh", "中文"],
  ["ja", "日本語"],
  ["hi", "हिन्दी"],
  ["fa", "فارسی"],
];
var keys = [
  "brand",
  "tagline",
  "workspace",
  "overview",
  "sectors",
  "data",
  "reports",
  "settings",
  "search",
  "add",
  "import",
  "run",
  "headline",
  "intro",
  "summary",
  "records",
  "alerts",
  "active",
  "health",
  "all",
  "anytime",
  "week",
  "trends",
  "actual",
  "limit",
  "attention",
  "empty",
  "addSector",
  "name",
  "description",
  "value",
  "date",
  "status",
  "normal",
  "review",
  "delete",
  "export",
  "close",
  "save",
  "language",
  "night",
  "motion",
  "compact",
  "rules",
  "checkLimits",
  "checkDuplicates",
  "outliers",
  "sensitivity",
  "expected",
  "reset",
  "confirmReset",
  "cancel",
  "importFile",
  "defaultSector",
  "defaultLimit",
  "template",
  "error",
  "required",
  "done",
  "reviewed",
  "details",
  "report",
  "disclaimer",
  "session",
  "noResults",
  "target",
  "clear",
  "appearance",
  "sectorRequired",
  "invalid",
  "fileError",
  "columns",
  "help",
  "helpText",
  "analysisDone",
  "limitFinding",
  "outlierFinding",
  "duplicateFinding",
  "high",
  "medium",
  "total",
  "settingsSaved",
  "missingThreshold",
];
var texts = {
  ar: [
    "رصد",
    "ذكاء البيانات، وضوح القرار.",
    "مساحة العمل",
    "نظرة عامة",
    "الأنشطة والعمليات",
    "مدخلات البيانات",
    "التقارير",
    "الإعدادات",
    "ابحث في بياناتك…",
    "إضافة سجل",
    "استيراد البيانات",
    "تشغيل التحليل",
    "الصورة الكاملة، في مكان واحد.",
    "اقرأ ما وراء الأرقام.",
    "ملخص الأداء",
    "السجلات المحللة",
    "الانحرافات المكتشفة",
    "الأنشطة والعمليات النشطة",
    "سلامة البيانات",
    "جميع الأنشطة والعمليات",
    "كل الفترات",
    "آخر 7 أيام",
    "اتجاهات البيانات",
    "الفعلية",
    "الحد المعتمد",
    "تحتاج إلى انتباهك",
    "لا توجد بيانات بعد",
    "إضافة نشاط أو عملية",
    "الاسم",
    "وصف السجل",
    "القيمة",
    "التاريخ",
    "الحالة",
    "ضمن الطبيعي",
    "مراجعة",
    "حذف",
    "تصدير",
    "إغلاق",
    "حفظ",
    "اللغة",
    "الوضع الليلي",
    "الحركات والانتقالات",
    "عرض مضغوط",
    "قواعد التحليل",
    "تجاوز الحدود",
    "كشف التكرار",
    "كشف القيم غير المعتادة",
    "معامل الحساسية IQR",
    "النسبة المتوقعة %",
    "مسح بيانات الجلسة",
    "هل تريد حذف كل الأنشطة والعمليات والسجلات؟",
    "إلغاء",
    "ملف Excel أو CSV",
    "النشاط أو العملية الافتراضية",
    "الحد الافتراضي",
    "تنزيل قالب فارغ",
    "خطأ",
    "أكمل الحقول المطلوبة",
    "تم بنجاح",
    "تمت المراجعة",
    "التفاصيل",
    "تقرير الرقابة على البيانات",
    "النتائج مؤشرات للمراجعة وليست إثباتًا لمخالفة.",
    "بيانات الجلسة فقط",
    "لا توجد نتائج",
    "المتوقعة",
    "مسح",
    "المظهر",
    "أضف نشاطًا أو عملية أولًا",
    "أدخل قيمة غير سالبة وحدًا أكبر من صفر وتاريخًا صحيحًا",
    "تعذرت قراءة الملف؛ تحقق من الأعمدة والقيم",
    "الأعمدة: label, value, limit, sector, date (YYYY-MM-DD)",
    "المساعدة",
    "البيانات تبقى خلال الجلسة وتُفقد عند إعادة التحميل. يمكنك تصديرها قبل المغادرة.",
    "اكتمل التحليل",
    "تجاوز الحد المعتمد",
    "قيمة غير معتادة",
    "سجل يحتمل التكرار",
    "مرتفع",
    "متوسط",
    "الإجمالي",
    "حُفظت الإعدادات",
    "حدد معامل الحساسية لتفعيل الكشف",
  ],
  en: [
    "Rasd",
    "Data intelligence. Clear decisions.",
    "Workspace",
    "Overview",
    "Activities & Operations",
    "Data entries",
    "Reports",
    "Settings",
    "Search your data…",
    "Add record",
    "Import data",
    "Run analysis",
    "The complete picture, in one place.",
    "Read beyond the numbers.",
    "Performance summary",
    "Analyzed records",
    "Detected anomalies",
    "Active activities & operations",
    "Data health",
    "All activities & operations",
    "All time",
    "Last 7 days",
    "Data trends",
    "Actual",
    "Approved limit",
    "Needs your attention",
    "No data yet",
    "Add activity or operation",
    "Name",
    "Record description",
    "Value",
    "Date",
    "Status",
    "Within range",
    "Review",
    "Delete",
    "Export",
    "Close",
    "Save",
    "Language",
    "Night mode",
    "Motion & transitions",
    "Compact view",
    "Analysis rules",
    "Limit violations",
    "Duplicate detection",
    "Outlier detection",
    "IQR sensitivity factor",
    "Expected percentage %",
    "Clear session data",
    "Delete all activities, operations and records?",
    "Cancel",
    "Excel or CSV file",
    "Default activity or operation",
    "Default limit",
    "Download empty template",
    "Error",
    "Complete the required fields",
    "Done successfully",
    "Reviewed",
    "Details",
    "Data oversight report",
    "Results are review indicators, not proof of a violation.",
    "Session data only",
    "No results",
    "Expected",
    "Clear",
    "Appearance",
    "Add an activity or operation first",
    "Enter a nonnegative value, a positive limit and a valid date",
    "Unable to read file; check columns and values",
    "Columns: label, value, limit, sector, date (YYYY-MM-DD)",
    "Help",
    "Data lasts for this session and is lost on reload. Export it before leaving.",
    "Analysis complete",
    "Approved limit exceeded",
    "Unusual value",
    "Possible duplicate",
    "High",
    "Medium",
    "Total",
    "Settings saved",
    "Set a sensitivity factor to enable detection",
  ],
  fr: [
    "Rasd",
    "Intelligence des données. Décisions claires.",
    "Espace de travail",
    "Vue générale",
    "Activités et opérations",
    "Données",
    "Rapports",
    "Paramètres",
    "Rechercher…",
    "Ajouter une entrée",
    "Importer",
    "Analyser",
    "Une vue complète, au même endroit.",
    "Au-delà des chiffres.",
    "Synthèse",
    "Entrées analysées",
    "Anomalies détectées",
    "Activités et opérations actives",
    "Qualité des données",
    "Toutes les activités et opérations",
    "Toute période",
    "7 derniers jours",
    "Tendances",
    "Réelles",
    "Limite autorisée",
    "À surveiller",
    "Aucune donnée",
    "Ajouter une activité ou opération",
    "Nom",
    "Description",
    "Valeur",
    "Date",
    "État",
    "Dans la norme",
    "Vérifier",
    "Supprimer",
    "Exporter",
    "Fermer",
    "Enregistrer",
    "Langue",
    "Mode nuit",
    "Animations et transitions",
    "Vue compacte",
    "Règles d’analyse",
    "Dépassement des limites",
    "Détection des doublons",
    "Valeurs atypiques",
    "Facteur IQR",
    "Pourcentage attendu %",
    "Effacer la session",
    "Supprimer toutes les activités, opérations et entrées ?",
    "Annuler",
    "Fichier Excel ou CSV",
    "Activité ou opération par défaut",
    "Limite par défaut",
    "Modèle vide",
    "Erreur",
    "Complétez les champs obligatoires",
    "Terminé",
    "Vérifié",
    "Détails",
    "Rapport de contrôle",
    "Les résultats sont des indicateurs, non des preuves.",
    "Données de session",
    "Aucun résultat",
    "Attendues",
    "Effacer",
    "Apparence",
    "Ajoutez d’abord une activité ou opération",
    "Saisissez une valeur positive ou nulle, une limite positive et une date valide",
    "Lecture impossible : vérifiez les colonnes",
    "Colonnes : label, value, limit, sector, date (YYYY-MM-DD)",
    "Aide",
    "Les données sont perdues au rechargement. Exportez-les avant de quitter.",
    "Analyse terminée",
    "Limite dépassée",
    "Valeur inhabituelle",
    "Doublon possible",
    "Élevé",
    "Moyen",
    "Total",
    "Paramètres enregistrés",
    "Définissez le facteur de sensibilité",
  ],
  es: [
    "Rasd",
    "Datos inteligentes. Decisiones claras.",
    "Espacio de trabajo",
    "Resumen",
    "Actividades y operaciones",
    "Registros",
    "Informes",
    "Ajustes",
    "Buscar…",
    "Añadir registro",
    "Importar datos",
    "Analizar",
    "Todo el panorama, en un lugar.",
    "Más allá de los números.",
    "Resumen de rendimiento",
    "Registros analizados",
    "Anomalías detectadas",
    "Actividades y operaciones activas",
    "Calidad de datos",
    "Todas las actividades y operaciones",
    "Todo el tiempo",
    "Últimos 7 días",
    "Tendencias",
    "Real",
    "Límite aprobado",
    "Requiere atención",
    "Sin datos todavía",
    "Añadir actividad u operación",
    "Nombre",
    "Descripción",
    "Valor",
    "Fecha",
    "Estado",
    "Dentro del rango",
    "Revisar",
    "Eliminar",
    "Exportar",
    "Cerrar",
    "Guardar",
    "Idioma",
    "Modo nocturno",
    "Animaciones y transiciones",
    "Vista compacta",
    "Reglas de análisis",
    "Excesos de límites",
    "Detectar duplicados",
    "Detectar valores atípicos",
    "Factor IQR",
    "Porcentaje esperado %",
    "Borrar sesión",
    "¿Eliminar todas las actividades, operaciones y registros?",
    "Cancelar",
    "Archivo Excel o CSV",
    "Actividad u operación predeterminada",
    "Límite predeterminado",
    "Plantilla vacía",
    "Error",
    "Completa los campos obligatorios",
    "Completado",
    "Revisado",
    "Detalles",
    "Informe de control",
    "Los resultados son indicadores, no pruebas.",
    "Datos de sesión",
    "Sin resultados",
    "Esperado",
    "Borrar",
    "Apariencia",
    "Añade primero una actividad u operación",
    "Introduce un valor no negativo, límite positivo y fecha válida",
    "No se puede leer el archivo; revisa las columnas",
    "Columnas: label, value, limit, sector, date (YYYY-MM-DD)",
    "Ayuda",
    "Los datos se pierden al recargar. Expórtalos antes de salir.",
    "Análisis completo",
    "Límite superado",
    "Valor inusual",
    "Posible duplicado",
    "Alto",
    "Medio",
    "Total",
    "Ajustes guardados",
    "Define el factor de sensibilidad",
  ],
  de: [
    "Rasd",
    "Daten verstehen. Klar entscheiden.",
    "Arbeitsbereich",
    "Übersicht",
    "Aktivitäten und Prozesse",
    "Datensätze",
    "Berichte",
    "Einstellungen",
    "Daten suchen…",
    "Datensatz hinzufügen",
    "Importieren",
    "Analysieren",
    "Das Gesamtbild an einem Ort.",
    "Mehr als nur Zahlen.",
    "Zusammenfassung",
    "Analysierte Datensätze",
    "Erkannte Abweichungen",
    "Aktive Aktivitäten und Prozesse",
    "Datenqualität",
    "Alle Aktivitäten und Prozesse",
    "Gesamter Zeitraum",
    "Letzte 7 Tage",
    "Datentrends",
    "Istwert",
    "Genehmigter Grenzwert",
    "Aufmerksamkeit nötig",
    "Noch keine Daten",
    "Aktivität oder Prozess hinzufügen",
    "Name",
    "Beschreibung",
    "Wert",
    "Datum",
    "Status",
    "Im Rahmen",
    "Prüfen",
    "Löschen",
    "Exportieren",
    "Schließen",
    "Speichern",
    "Sprache",
    "Nachtmodus",
    "Animationen und Übergänge",
    "Kompakte Ansicht",
    "Analyseregeln",
    "Grenzüberschreitungen",
    "Duplikate erkennen",
    "Ausreißer erkennen",
    "IQR-Faktor",
    "Erwarteter Prozentsatz %",
    "Sitzung löschen",
    "Alle Aktivitäten, Prozesse und Datensätze löschen?",
    "Abbrechen",
    "Excel- oder CSV-Datei",
    "Standardaktivität oder -prozess",
    "Standardgrenzwert",
    "Leere Vorlage",
    "Fehler",
    "Pflichtfelder ausfüllen",
    "Erfolgreich",
    "Geprüft",
    "Details",
    "Datenkontrollbericht",
    "Ergebnisse sind Hinweise, keine Beweise.",
    "Nur Sitzungsdaten",
    "Keine Ergebnisse",
    "Sollwert",
    "Leeren",
    "Darstellung",
    "Zuerst eine Aktivität oder einen Prozess hinzufügen",
    "Nichtnegativen Wert, positiven Grenzwert und gültiges Datum eingeben",
    "Datei nicht lesbar; Spalten prüfen",
    "Spalten: label, value, limit, sector, date (YYYY-MM-DD)",
    "Hilfe",
    "Daten gehen beim Neuladen verloren. Vorher exportieren.",
    "Analyse abgeschlossen",
    "Grenzwert überschritten",
    "Ungewöhnlicher Wert",
    "Mögliches Duplikat",
    "Hoch",
    "Mittel",
    "Gesamt",
    "Einstellungen gespeichert",
    "Empfindlichkeitsfaktor festlegen",
  ],
  tr: [
    "Rasd",
    "Akıllı veriler. Net kararlar.",
    "Çalışma alanı",
    "Genel bakış",
    "Faaliyetler ve süreçler",
    "Veri kayıtları",
    "Raporlar",
    "Ayarlar",
    "Veri ara…",
    "Kayıt ekle",
    "İçe aktar",
    "Analiz et",
    "Bütün tablo, tek bir yerde.",
    "Rakamların ötesine bakın.",
    "Performans özeti",
    "Analiz edilen kayıtlar",
    "Tespit edilen sapmalar",
    "Aktif faaliyetler ve süreçler",
    "Veri sağlığı",
    "Tüm faaliyetler ve süreçler",
    "Tüm zamanlar",
    "Son 7 gün",
    "Veri eğilimleri",
    "Gerçek",
    "Onaylı sınır",
    "Dikkat gerekiyor",
    "Henüz veri yok",
    "Faaliyet veya süreç ekle",
    "Ad",
    "Açıklama",
    "Değer",
    "Tarih",
    "Durum",
    "Normal aralık",
    "İncele",
    "Sil",
    "Dışa aktar",
    "Kapat",
    "Kaydet",
    "Dil",
    "Gece modu",
    "Animasyon ve geçişler",
    "Kompakt görünüm",
    "Analiz kuralları",
    "Sınır ihlalleri",
    "Tekrar tespiti",
    "Aykırı değer tespiti",
    "IQR hassasiyet katsayısı",
    "Beklenen yüzde %",
    "Oturumu temizle",
    "Tüm faaliyetler, süreçler ve kayıtlar silinsin mi?",
    "İptal",
    "Excel veya CSV dosyası",
    "Varsayılan faaliyet veya süreç",
    "Varsayılan sınır",
    "Boş şablon",
    "Hata",
    "Zorunlu alanları doldurun",
    "Başarılı",
    "İncelendi",
    "Ayrıntılar",
    "Veri denetim raporu",
    "Sonuçlar inceleme göstergesidir, kanıt değildir.",
    "Yalnızca oturum verileri",
    "Sonuç yok",
    "Beklenen",
    "Temizle",
    "Görünüm",
    "Önce faaliyet veya süreç ekleyin",
    "Negatif olmayan değer, pozitif sınır ve geçerli tarih girin",
    "Dosya okunamadı; sütunları kontrol edin",
    "Sütunlar: label, value, limit, sector, date (YYYY-MM-DD)",
    "Yardım",
    "Veriler yenilemede kaybolur. Ayrılmadan dışa aktarın.",
    "Analiz tamamlandı",
    "Sınır aşıldı",
    "Olağandışı değer",
    "Olası tekrar",
    "Yüksek",
    "Orta",
    "Toplam",
    "Ayarlar kaydedildi",
    "Hassasiyet katsayısı belirleyin",
  ],
  pt: [
    "Rasd",
    "Dados inteligentes. Decisões claras.",
    "Área de trabalho",
    "Visão geral",
    "Atividades e operações",
    "Registros",
    "Relatórios",
    "Configurações",
    "Pesquisar…",
    "Adicionar registro",
    "Importar dados",
    "Analisar",
    "A visão completa em um só lugar.",
    "Além dos números.",
    "Resumo de desempenho",
    "Registros analisados",
    "Anomalias detectadas",
    "Atividades e operações ativas",
    "Qualidade dos dados",
    "Todas as atividades e operações",
    "Todo o período",
    "Últimos 7 dias",
    "Tendências",
    "Real",
    "Limite aprovado",
    "Requer atenção",
    "Sem dados",
    "Adicionar atividade ou operação",
    "Nome",
    "Descrição",
    "Valor",
    "Data",
    "Estado",
    "Dentro do limite",
    "Revisar",
    "Excluir",
    "Exportar",
    "Fechar",
    "Salvar",
    "Idioma",
    "Modo noturno",
    "Animações e transições",
    "Visão compacta",
    "Regras de análise",
    "Excesso de limites",
    "Detectar duplicados",
    "Detectar valores atípicos",
    "Fator IQR",
    "Percentual esperado %",
    "Limpar sessão",
    "Excluir todas as atividades, operações e registros?",
    "Cancelar",
    "Arquivo Excel ou CSV",
    "Atividade ou operação padrão",
    "Limite padrão",
    "Modelo vazio",
    "Erro",
    "Preencha os campos obrigatórios",
    "Concluído",
    "Revisado",
    "Detalhes",
    "Relatório de controle",
    "Resultados são indicadores, não provas.",
    "Dados da sessão",
    "Sem resultados",
    "Esperado",
    "Limpar",
    "Aparência",
    "Adicione primeiro uma atividade ou operação",
    "Informe valor não negativo, limite positivo e data válida",
    "Falha ao ler; confira as colunas",
    "Colunas: label, value, limit, sector, date (YYYY-MM-DD)",
    "Ajuda",
    "Dados são perdidos ao recarregar. Exporte antes de sair.",
    "Análise concluída",
    "Limite excedido",
    "Valor incomum",
    "Possível duplicado",
    "Alto",
    "Médio",
    "Total",
    "Configurações salvas",
    "Defina o fator de sensibilidade",
  ],
  ru: [
    "Rasd",
    "Умные данные. Ясные решения.",
    "Рабочая область",
    "Обзор",
    "Виды деятельности и операции",
    "Записи",
    "Отчёты",
    "Настройки",
    "Поиск…",
    "Добавить запись",
    "Импорт",
    "Анализировать",
    "Полная картина в одном месте.",
    "За пределами цифр.",
    "Сводка",
    "Записи проанализированы",
    "Отклонения",
    "Активные виды деятельности и операции",
    "Качество данных",
    "Все виды деятельности и операции",
    "Всё время",
    "Последние 7 дней",
    "Тенденции",
    "Факт",
    "Утверждённый лимит",
    "Требует внимания",
    "Данных пока нет",
    "Добавить деятельность или операцию",
    "Название",
    "Описание",
    "Значение",
    "Дата",
    "Статус",
    "В пределах нормы",
    "Проверить",
    "Удалить",
    "Экспорт",
    "Закрыть",
    "Сохранить",
    "Язык",
    "Ночной режим",
    "Анимации и переходы",
    "Компактный вид",
    "Правила анализа",
    "Превышение лимитов",
    "Поиск дубликатов",
    "Поиск выбросов",
    "Коэффициент IQR",
    "Ожидаемый процент %",
    "Очистить сеанс",
    "Удалить все виды деятельности, операции и записи?",
    "Отмена",
    "Файл Excel или CSV",
    "Деятельность или операция по умолчанию",
    "Лимит по умолчанию",
    "Пустой шаблон",
    "Ошибка",
    "Заполните обязательные поля",
    "Готово",
    "Проверено",
    "Подробности",
    "Отчёт контроля",
    "Результаты — индикаторы, а не доказательства.",
    "Данные сеанса",
    "Нет результатов",
    "Ожидание",
    "Очистить",
    "Оформление",
    "Сначала добавьте деятельность или операцию",
    "Введите неотрицательное значение, положительный лимит и корректную дату",
    "Файл не читается; проверьте столбцы",
    "Столбцы: label, value, limit, sector, date (YYYY-MM-DD)",
    "Помощь",
    "При перезагрузке данные теряются. Экспортируйте их заранее.",
    "Анализ завершён",
    "Лимит превышен",
    "Необычное значение",
    "Возможный дубликат",
    "Высокий",
    "Средний",
    "Всего",
    "Настройки сохранены",
    "Укажите коэффициент чувствительности",
  ],
  zh: [
    "Rasd",
    "智能数据，清晰决策。",
    "工作区",
    "概览",
    "活动与业务",
    "数据记录",
    "报告",
    "设置",
    "搜索数据…",
    "添加记录",
    "导入数据",
    "运行分析",
    "完整视图，尽在一处。",
    "洞察数字背后的意义。",
    "汇总",
    "已分析记录",
    "检测到的异常",
    "活跃活动与业务",
    "数据健康度",
    "全部活动与业务",
    "全部时间",
    "最近7天",
    "数据趋势",
    "实际值",
    "批准限额",
    "需要关注",
    "暂无数据",
    "添加活动或业务",
    "名称",
    "描述",
    "数值",
    "日期",
    "状态",
    "正常范围",
    "审核",
    "删除",
    "导出",
    "关闭",
    "保存",
    "语言",
    "夜间模式",
    "动画与过渡",
    "紧凑视图",
    "分析规则",
    "限额超标",
    "重复检测",
    "异常值检测",
    "IQR灵敏度系数",
    "预期百分比 %",
    "清空会话数据",
    "删除所有活动、业务和记录？",
    "取消",
    "Excel或CSV文件",
    "默认活动或业务",
    "默认限额",
    "下载空模板",
    "错误",
    "请填写必填项",
    "已完成",
    "已审核",
    "详情",
    "数据监督报告",
    "结果仅供审核，不构成违规证据。",
    "仅会话数据",
    "无结果",
    "预期值",
    "清空",
    "外观",
    "请先添加活动或业务",
    "请输入非负数值、正数限额及有效日期",
    "无法读取文件，请检查列和值",
    "列：label, value, limit, sector, date (YYYY-MM-DD)",
    "帮助",
    "刷新后数据将丢失，请先导出。",
    "分析完成",
    "超出限额",
    "异常数值",
    "可能重复",
    "高",
    "中",
    "总计",
    "设置已保存",
    "请设置灵敏度系数",
  ],
  ja: [
    "Rasd",
    "データの知性。明確な判断。",
    "ワークスペース",
    "概要",
    "活動・業務",
    "データ記録",
    "レポート",
    "設定",
    "データ検索…",
    "記録を追加",
    "インポート",
    "分析する",
    "全体像をひとつの場所に。",
    "数字の先を読む。",
    "概要",
    "分析済み記録",
    "検出された異常",
    "稼働中の活動・業務",
    "データ健全性",
    "全活動・業務",
    "全期間",
    "過去7日間",
    "データ推移",
    "実績",
    "承認上限",
    "要確認",
    "データなし",
    "活動・業務を追加",
    "名前",
    "説明",
    "値",
    "日付",
    "状態",
    "正常範囲",
    "確認",
    "削除",
    "エクスポート",
    "閉じる",
    "保存",
    "言語",
    "ナイトモード",
    "アニメーションと遷移",
    "コンパクト表示",
    "分析ルール",
    "上限超過",
    "重複検出",
    "外れ値検出",
    "IQR感度係数",
    "予測割合 %",
    "セッション消去",
    "すべての活動・業務と記録を削除しますか？",
    "キャンセル",
    "ExcelまたはCSV",
    "既定の活動・業務",
    "既定の上限",
    "空テンプレート",
    "エラー",
    "必須項目を入力してください",
    "完了",
    "確認済み",
    "詳細",
    "データ監査レポート",
    "結果は確認の指標であり、違反の証拠ではありません。",
    "セッションのみ",
    "結果なし",
    "予測",
    "消去",
    "外観",
    "先に活動・業務を追加してください",
    "非負の値、正の上限、有効な日付を入力してください",
    "ファイルを読めません。列と値を確認してください",
    "列：label, value, limit, sector, date (YYYY-MM-DD)",
    "ヘルプ",
    "再読み込みでデータは失われます。先にエクスポートしてください。",
    "分析完了",
    "上限超過",
    "異常値",
    "重複の可能性",
    "高",
    "中",
    "合計",
    "設定を保存しました",
    "感度係数を設定してください",
  ],
  hi: [
    "Rasd",
    "बुद्धिमान डेटा। स्पष्ट निर्णय।",
    "कार्यस्थल",
    "अवलोकन",
    "गतिविधियाँ और संचालन",
    "डेटा रिकॉर्ड",
    "रिपोर्ट",
    "सेटिंग्स",
    "डेटा खोजें…",
    "रिकॉर्ड जोड़ें",
    "डेटा आयात",
    "विश्लेषण करें",
    "पूरी तस्वीर, एक जगह।",
    "संख्याओं से आगे देखें।",
    "सारांश",
    "विश्लेषित रिकॉर्ड",
    "विसंगतियाँ",
    "सक्रिय गतिविधियाँ और संचालन",
    "डेटा गुणवत्ता",
    "सभी गतिविधियाँ और संचालन",
    "सभी समय",
    "पिछले 7 दिन",
    "डेटा रुझान",
    "वास्तविक",
    "स्वीकृत सीमा",
    "ध्यान दें",
    "अभी डेटा नहीं",
    "गतिविधि या संचालन जोड़ें",
    "नाम",
    "विवरण",
    "मान",
    "तिथि",
    "स्थिति",
    "सामान्य",
    "समीक्षा",
    "हटाएँ",
    "निर्यात",
    "बंद करें",
    "सहेजें",
    "भाषा",
    "रात्रि मोड",
    "एनिमेशन और बदलाव",
    "संक्षिप्त दृश्य",
    "विश्लेषण नियम",
    "सीमा उल्लंघन",
    "डुप्लिकेट जाँच",
    "असामान्य मान जाँच",
    "IQR संवेदनशीलता",
    "अपेक्षित प्रतिशत %",
    "सत्र साफ करें",
    "सभी गतिविधियाँ, संचालन और रिकॉर्ड हटाएँ?",
    "रद्द करें",
    "Excel या CSV फ़ाइल",
    "डिफ़ॉल्ट गतिविधि या संचालन",
    "डिफ़ॉल्ट सीमा",
    "खाली टेम्पलेट",
    "त्रुटि",
    "आवश्यक फ़ील्ड भरें",
    "पूर्ण",
    "समीक्षित",
    "विवरण",
    "डेटा निरीक्षण रिपोर्ट",
    "परिणाम समीक्षा संकेत हैं, उल्लंघन का प्रमाण नहीं।",
    "केवल सत्र डेटा",
    "कोई परिणाम नहीं",
    "अपेक्षित",
    "साफ करें",
    "दिखावट",
    "पहले गतिविधि या संचालन जोड़ें",
    "गैर-ऋणात्मक मान, धनात्मक सीमा और सही तिथि दें",
    "फ़ाइल पढ़ नहीं सके; कॉलम जाँचें",
    "कॉलम: label, value, limit, sector, date (YYYY-MM-DD)",
    "सहायता",
    "रीलोड पर डेटा खो जाता है। पहले निर्यात करें।",
    "विश्लेषण पूर्ण",
    "सीमा पार",
    "असामान्य मान",
    "संभावित डुप्लिकेट",
    "उच्च",
    "मध्यम",
    "कुल",
    "सेटिंग्स सहेजी गईं",
    "संवेदनशीलता मान दें",
  ],
  fa: [
    "رصد",
    "داده‌های هوشمند، تصمیم‌های روشن.",
    "فضای کار",
    "نمای کلی",
    "فعالیت‌ها و عملیات",
    "ورودی داده‌ها",
    "گزارش‌ها",
    "تنظیمات",
    "جستجوی داده…",
    "افزودن رکورد",
    "وارد کردن داده",
    "اجرای تحلیل",
    "تصویر کامل در یک مکان.",
    "فراتر از اعداد بخوانید.",
    "خلاصه عملکرد",
    "رکوردهای تحلیل‌شده",
    "ناهنجاری‌ها",
    "فعالیت‌ها و عملیات فعال",
    "سلامت داده",
    "همه فعالیت‌ها و عملیات",
    "همه زمان‌ها",
    "۷ روز گذشته",
    "روند داده",
    "واقعی",
    "حد مجاز",
    "نیازمند توجه",
    "هنوز داده‌ای نیست",
    "افزودن فعالیت یا عملیات",
    "نام",
    "شرح",
    "مقدار",
    "تاریخ",
    "وضعیت",
    "در محدوده",
    "بررسی",
    "حذف",
    "خروجی",
    "بستن",
    "ذخیره",
    "زبان",
    "حالت شب",
    "حرکت و انتقال",
    "نمای فشرده",
    "قواعد تحلیل",
    "تجاوز از حد",
    "تشخیص تکرار",
    "تشخیص مقادیر غیرعادی",
    "ضریب حساسیت IQR",
    "درصد مورد انتظار %",
    "پاک کردن نشست",
    "همه فعالیت‌ها، عملیات و رکوردها حذف شوند؟",
    "لغو",
    "فایل Excel یا CSV",
    "فعالیت یا عملیات پیش‌فرض",
    "حد پیش‌فرض",
    "قالب خالی",
    "خطا",
    "فیلدهای ضروری را تکمیل کنید",
    "انجام شد",
    "بررسی‌شده",
    "جزئیات",
    "گزارش نظارت داده",
    "نتایج شاخص بررسی هستند، نه اثبات تخلف.",
    "فقط داده نشست",
    "نتیجه‌ای نیست",
    "مورد انتظار",
    "پاک کردن",
    "ظاهر",
    "ابتدا فعالیت یا عملیات اضافه کنید",
    "مقدار غیرمنفی، حد مثبت و تاریخ معتبر وارد کنید",
    "فایل خوانده نشد؛ ستون‌ها را بررسی کنید",
    "ستون‌ها: label, value, limit, sector, date (YYYY-MM-DD)",
    "راهنما",
    "با بارگذاری مجدد داده‌ها از بین می‌روند. ابتدا خروجی بگیرید.",
    "تحلیل کامل شد",
    "تجاوز از حد",
    "مقدار غیرعادی",
    "تکرار احتمالی",
    "بالا",
    "متوسط",
    "مجموع",
    "تنظیمات ذخیره شد",
    "ضریب حساسیت را مشخص کنید",
  ],
};
function translator(language) {
  return (key) =>
    texts[language]?.[keys.indexOf(key)] ??
    texts["en"]?.[keys.indexOf(key)] ??
    key;
}
var isRtl = (language) => ["ar", "fa"].includes(language);
var f = (key, label, type = "text") => ({
  key,
  label,
  type,
});
var auditSectors = [
  {
    key: "finance",
    label: "الأنشطة والعمليات المالية والمحاسبية",
    en: "Financial & Accounting Activities & Operations",
    goal: "إحكام الرقابة على النقدية، الحسابات، والتسويات المصرفية.",
    datasets: [
      {
        key: "Receipt_Vouchers",
        label: "سندات القبض",
        fields: [
          f("voucher_no", "رقم سند القبض"),
          f("date", "تاريخ القبض", "date"),
          f("amount", "المبلغ المقبوض", "number"),
          f("payer", "المقبوض منه"),
          f("revenue_type", "نوع الإيراد / الغرض"),
          f("credit_account", "الحساب الدائن"),
          f("method", "طريقة القبض (نقدي / شيك / تحويل)"),
          f("cheque_no", "رقم الشيك"),
          f("cheque_status", "حالة الشيك (معلق / محصل / مرتجع / بدون رصيد)"),
          f("deposit_date", "تاريخ الإيداع البنكي", "date"),
          f("deposited_amount", "المبلغ المودع", "number"),
          f("deposit_ref", "رقم إشعار الإيداع"),
          f("status", "حالة السند (معتمد / ملغى)"),
          f("cancel_reason", "سبب الإلغاء"),
        ],
      },
      {
        key: "Payment_Vouchers",
        label: "سندات الصرف",
        fields: [
          f("voucher_no", "رقم سند الصرف"),
          f("date", "التاريخ", "date"),
          f("amount", "المبلغ", "number"),
          f("payee", "الحساب المدفوع له"),
          f("budget_item", "بند الموازنة المقابل"),
          f("method", "طريقة الصرف"),
          f("support_doc", "رقم المستند المعزز"),
          f("approver", "معتمد الصرف"),
          f("status", "حالة السند (معتمد / ملغى)"),
          f("cancel_reason", "سبب الإلغاء"),
          f("entered_by", "مُدخل السند"),
          f("paid_by", "منفّذ الصرف"),
        ],
      },
      {
        key: "Trial_Balance",
        label: "ميزان المراجعة",
        fields: [
          f("account_no", "رقم الحساب"),
          f("account_name", "اسم الحساب"),
          f("opening", "رصيد أول المدة", "number"),
          f("debit", "حركات المدين", "number"),
          f("credit", "حركات الدائن", "number"),
          f("closing", "الرصيد الختامي", "number"),
          f("nature", "طبيعة الرصيد"),
        ],
      },
      {
        key: "Adjustments",
        label: "قيود التسوية",
        fields: [
          f("entry_no", "رقم قيد التسوية"),
          f("date", "التاريخ", "date"),
          f("debit_account", "الحساب المدين"),
          f("credit_account", "الحساب الدائن"),
          f("amount", "قيمة التعديل", "number"),
          f("reason", "سبب التسوية"),
          f("requester", "الجهة الطالبة"),
        ],
      },
      {
        key: "Bank_Reconciliations",
        label: "التسويات البنكية",
        fields: [
          f("bank_account", "اسم البنك ورقم الحساب"),
          f("statement_date", "تاريخ الكشف", "date"),
          f("bank_balance", "الرصيد حسب البنك", "number"),
          f("book_balance", "الرصيد حسب الدفاتر", "number"),
          f("outstanding_checks", "الشيكات المعلقة", "number"),
          f("oldest_check_date", "تاريخ أقدم شيك معلق", "date"),
          f("deposits_in_transit", "الإيداعات بالطريق", "number"),
          f("bank_charges", "عمولات ومصاريف بنكية غير مسجلة", "number"),
          f("unrecorded_credits", "إيداعات بنكية غير مسجلة بالدفاتر", "number"),
          f("difference", "فروقات التسوية", "number"),
          f("prepared_by", "معد التسوية"),
          f("reviewed_by", "مراجع التسوية"),
        ],
      },
      {
        key: "Petty_Cash",
        label: "الصناديق والعهد النقدية",
        fields: [
          f("box", "رقم الصندوق / أمين الصندوق"),
          f("approved", "قيمة العهدة المعتمدة", "number"),
          f("actual", "الرصيد الفعلي بالصندوق", "number"),
          f("unsettled_docs", "المستندات غير المسواة", "number"),
          f("last_replenish", "تاريخ آخر استعاضة", "date"),
          f("last_count", "تاريخ آخر جرد مفاجئ", "date"),
          f("counted_by", "القائم بالجرد"),
        ],
      },
      {
        key: "Clearing_Accounts",
        label: "الحسابات الوسيطة",
        fields: [
          f("account_no", "رقم الحساب الوسيط"),
          f("account_name", "اسم الحساب"),
          f("date", "تاريخ الحركة", "date"),
          f("amount", "المبلغ", "number"),
          f("reason", "سبب التعليق"),
          f("target_close", "تاريخ الإغلاق المستهدف", "date"),
        ],
      },
      {
        key: "Revenue_Profession_Licenses",
        label: "رخص المهن والصناعات",
        fields: [
          f("license_no", "رقم الرخصة"),
          f("date", "تاريخ الإصدار", "date"),
          f("owner", "اسم صاحب المنشأة"),
          f("profession", "المهنة / الصناعة"),
          f("fee_due", "الرسوم المستحقة", "number"),
          f("fee_paid", "الرسوم المحصلة", "number"),
          f("receipt_no", "رقم سند القبض"),
          f("bank_deposit", "المبلغ الواصل للحساب البنكي", "number"),
          f("status", "حالة الرخصة"),
        ],
      },
      {
        key: "Revenue_Property_Taxes_Regulation",
        label: "عوائد التنظيم والتعبيد والمسقفات",
        fields: [
          f("parcel_no", "رقم القطعة / المكلف"),
          f("owner", "اسم المكلف"),
          f("tax_type", "نوع العائد (تنظيم / تعبيد / مسقفات / أبراضي)"),
          f("year", "السنة المالية"),
          f("amount_due", "المبلغ المستحق", "number"),
          f("amount_paid", "المبلغ المحصل", "number"),
          f("receipt_no", "رقم سند القبض"),
          f("bank_deposit", "المبلغ الواصل للحساب البنكي", "number"),
          f("last_payment", "تاريخ آخر تحصيل", "date"),
        ],
      },
      {
        key: "Revenue_Municipal_Properties_Leases",
        label: "عقود تأجير الأملاك البلدية",
        fields: [
          f("contract_no", "رقم العقد"),
          f("property", "العقار (محل / مخزن / كشك / سوق)"),
          f("tenant", "المستأجر"),
          f("start_date", "تاريخ بدء العقد", "date"),
          f("end_date", "تاريخ انتهاء العقد", "date"),
          f("installment", "قيمة القسط", "number"),
          f("due_date", "تاريخ استحقاق القسط", "date"),
          f("paid_date", "تاريخ السداد الفعلي", "date"),
          f("paid_amount", "المبلغ المسدد", "number"),
          f("receipt_no", "رقم سند القبض"),
        ],
      },
      {
        key: "Revenue_Daily_Fees",
        label: "رسوم الخدمات اليومية",
        fields: [
          f("date", "التاريخ", "date"),
          f("service", "الخدمة (مسلخ / سوق مركزي / أذونات حفر / مواقف)"),
          f("receipt_book", "رقم الوصل / الدفتر"),
          f("amount_due", "المبلغ المستحق", "number"),
          f("amount_collected", "المبلغ المحصل", "number"),
          f("collector", "المحصّل"),
          f("deposit_date", "تاريخ التوريد", "date"),
          f("deposited_amount", "المبلغ المورد", "number"),
        ],
      },
    ],
  },
  {
    key: "hr",
    label: "أنشطة وعمليات الموارد البشرية والرواتب",
    en: "HR & Payroll Activities & Operations",
    goal: "التحقق من قانونية التعيينات، الرواتب، الإجازات، ومكافآت نهاية الخدمة.",
    datasets: [
      {
        key: "HR_Establishment_Table",
        label: "جدول التشكيلات المعتمد",
        fields: [
          f("position_no", "رقم الوظيفة"),
          f("title", "المسمى الوظيفي المعتمد"),
          f("grade", "الدرجة المقررة"),
          f("department", "القسم / المديرية"),
          f("annual_allocation", "المخصص المالي السنوي", "number"),
          f("notes", "ملاحظات"),
        ],
      },
      {
        key: "HR_Payroll_Sheets",
        label: "كشوفات الرواتب",
        fields: [
          f("employee_no", "الرقم الوظيفي"),
          f("name", "اسم الموظف"),
          f("national_id", "الرقم الوطني"),
          f("position_no", "رقم الوظيفة"),
          f("title", "المسمى الوظيفي الفعلي"),
          f("grade", "الدرجة الممنوحة"),
          f("hire_date", "تاريخ التعيين", "date"),
          f("appointment_decision", "رقم قرار التعيين"),
          f("status", "حالة الموظف (على رأس العمل / منقطع / موقوف ...)"),
          f("attendance_days", "أيام الحضور الفعلية", "number"),
          f("bank_account", "رقم الحساب البنكي / IBAN"),
          f("basic", "الراتب الأساسي", "number"),
          f("allowances", "إجمالي العلاوات", "number"),
          f("net", "الصافي", "number"),
          f("phone", "رقم الهاتف"),
          f("address", "العنوان"),
        ],
      },
      {
        key: "HR_Overtime_Bonuses",
        label: "العمل الإضافي والمكافآت",
        fields: [
          f("employee_no", "رقم الموظف"),
          f("name", "اسم الموظف"),
          f("department", "القسم"),
          f("project", "المشروع"),
          f("period", "الفترة (شهر/سنة)"),
          f("hours", "ساعات العمل الإضافي", "number"),
          f("approved_hours", "الساعات المعتمدة مسبقاً", "number"),
          f("biometric_hours", "ساعات الإضافي المثبتة بالبصمة", "number"),
          f("overtime_pay", "قيمة الإضافي المصروفة", "number"),
          f("report", "تقرير الإنجاز"),
          f("bonus", "قيمة المكافأة المصروفة", "number"),
        ],
      },
      {
        key: "HR_Leaves_Records",
        label: "سجلات الإجازات",
        fields: [
          f("employee_no", "رقم الموظف"),
          f("name", "اسم الموظف"),
          f("type", "نوع الإجازة"),
          f("start", "تاريخ البداية", "date"),
          f("end", "تاريخ النهاية", "date"),
          f("balance", "رصيد الإجازات المتبقي", "number"),
        ],
      },
      {
        key: "HR_Daily_Wagers",
        label: "عمال المياومة والعقود المؤقتة",
        fields: [
          f("id_no", "الرقم التعريفي"),
          f("name", "اسم العامل"),
          f("project", "المشروع / القسم"),
          f("period", "الفترة (شهر/سنة)"),
          f("days", "أيام العمل الفعلية", "number"),
          f("daily_wage", "الأجر اليومي", "number"),
          f("total", "إجمالي المستحق", "number"),
          f("completion_report", "تقرير الإنجاز / شهادة الإنجاز"),
          f("phone", "رقم الهاتف"),
          f("address", "العنوان"),
          f("bank_account", "رقم الحساب البنكي / IBAN"),
        ],
      },
      {
        key: "HR_Promotions_Increments",
        label: "الترقيات والعلاوات",
        fields: [
          f("employee_no", "رقم الموظف"),
          f("name", "اسم الموظف"),
          f("old_grade", "الدرجة السابقة"),
          f("new_grade", "الدرجة الجديدة"),
          f("due_date", "تاريخ الاستحقاق", "date"),
          f("decision_no", "رقم قرار الترقية"),
          f("increment_amount", "قيمة العلاوة", "number"),
        ],
      },
      {
        key: "HR_Retirees_Settlements",
        label: "المتقاعدون والتسويات",
        fields: [
          f("retiree_no", "رقم الموظف / التقاعدي"),
          f("name", "اسم المتقاعد"),
          f("retire_date", "تاريخ الإحالة للتقاعد", "date"),
          f("reason", "سبب التقاعد"),
          f("gratuity", "مكافأة نهاية الخدمة / بدل الإجازات", "number"),
          f("clearance_no", "رقم براءة الذمة"),
        ],
      },
    ],
  },
  {
    key: "fleet",
    label: "أنشطة وعمليات الحركة والمحروقات والصيانة",
    en: "Fleet, Fuel & Maintenance Activities & Operations",
    goal: "مراقبة الآليات، رصد استهلاك الوقود عبر الأنظمة الذكية، والتتبع القانوني.",
    datasets: [
      {
        key: "Fleet_Movement_Orders",
        label: "أوامر الحركة",
        fields: [
          f("order_no", "رقم أمر الحركة"),
          f("date", "تاريخ الخروج", "date"),
          f("driver", "اسم السائق"),
          f("vehicle", "رقم الآلية"),
          f("route", "خط سير الرحلة"),
          f("purpose", "الغرض الرسمي"),
        ],
      },
      {
        key: "Fleet_GPS_Tracking_Logs",
        label: "نظام التتبع الذكي",
        fields: [
          f("vehicle", "رقم الآلية"),
          f("datetime", "تاريخ ووقت الحركة"),
          f("actual_route", "مسار الرحلة الفعلي (GPS)"),
          f("off_hours", "تشغيل خارج الدوام / العطل"),
          f("geofence", "تجاوز النطاق الجغرافي"),
        ],
      },
      {
        key: "Fleet_Fuel_System_Logs",
        label: "نظام المحروقات الآلي",
        fields: [
          f("vehicle", "رقم الآلية"),
          f("liters", "كمية المحروقات (نظام المحروقات)", "number"),
          f("odometer", "قراءة العداد عند التعبئة", "number"),
          f("rate", "معدل الاستهلاك المحسوب", "number"),
          f("order_match", "مطابقة أمر الحركة"),
        ],
      },
      {
        key: "Fleet_Station_Fuel_Statements",
        label: "كشوفات البطاقة الذكية",
        fields: [
          f("vehicle", "رقم الآلية"),
          f("card_no", "رقم البطاقة الذكية"),
          f("datetime", "تاريخ ووقت التعبئة"),
          f("liters", "الكمية المؤكدة (كشف المحطة)", "number"),
          f("unit_price", "سعر اللتر (فاتورة المحطة)", "number"),
          f("amount", "القيمة المالية للفاتورة", "number"),
          f("contract_price", "سعر اللتر حسب العقد", "number"),
          f("invoice_no", "رقم الفاتورة"),
        ],
      },
      {
        key: "Fleet_Maintenance",
        label: "الصيانة وقطع الغيار",
        fields: [
          f("vehicle", "رقم الآلية"),
          f("date", "تاريخ الصيانة", "date"),
          f("description", "وصف الإصلاح"),
          f("parts_cost", "تكلفة قطع الغيار", "number"),
          f("workshop", "ورشة الإصلاح"),
          f("invoice_no", "رقم الفاتورة"),
        ],
      },
      {
        key: "Fleet_Licensing_Insurance",
        label: "الترخيص والتأمين",
        fields: [
          f("plate", "رقم الآلية / اللوحة"),
          f("model", "نوع الآلية والموديل"),
          f("prev_expiry", "تاريخ انتهاء الرخصة السابقة", "date"),
          f("new_license", "تاريخ الترخيص الجديد ورقم الإيصال"),
          f("fees", "تكلفة الرسوم والتأمين", "number"),
          f("insurance_status", "حالة التأمين"),
          f("insurance_expiry", "تاريخ انتهاء بوليصة التأمين", "date"),
        ],
      },
    ],
  },
  {
    key: "warehouses",
    label: "أنشطة وعمليات المستودعات والعهد",
    en: "Warehouses & Inventory Activities & Operations",
    goal: "إدارة المخزون، ضبط السندات، مراقبة الجرد الفعلي، ومعالجة المواد الراكدة.",
    datasets: [
      {
        key: "Warehouse_Master_List",
        label: "كشف محتويات المستودع الشامل",
        fields: [
          f("item_no", "رقم الصنف"),
          f("description", "وصف الصنف التفصيلي"),
          f("category", "تصنيف الصنف"),
          f("unit", "وحدة القياس"),
          f("reorder", "حد التطلب (الحد الأدنى)", "number"),
          f("cost", "التكلفة التقديرية", "number"),
          f("location", "موقع التخزين"),
          f("notes", "ملاحظات"),
        ],
      },
      {
        key: "Warehouses_Inbound_Vouchers",
        label: "سندات الإدخال",
        fields: [
          f("voucher_no", "رقم سند الإدخال"),
          f("date", "التاريخ", "date"),
          f("supplier", "اسم المورد"),
          f("po_no", "رقم أمر الشراء"),
          f("item_no", "رقم الصنف"),
          f("qty", "الكمية الواردة", "number"),
          f("total", "القيمة الإجمالية", "number"),
          f("received_by", "أمين المستودع المستلم"),
        ],
      },
      {
        key: "Warehouses_Outbound_Vouchers",
        label: "سندات الإخراج",
        fields: [
          f("voucher_no", "رقم سند الإخراج"),
          f("date", "التاريخ", "date"),
          f("department", "القسم المستفيد"),
          f("receiver", "اسم المستلم"),
          f("item_no", "رقم الصنف"),
          f("qty", "الكمية المصروفة", "number"),
          f("purpose", "الغرض"),
        ],
      },
      {
        key: "Warehouses_Physical_Stocktaking",
        label: "نتائج الجرد الفعلي",
        fields: [
          f("item_no", "رقم الصنف"),
          f("name", "اسم المادة"),
          f("unit", "وحدة القياس"),
          f("book", "الرصيد الدفتري", "number"),
          f("physical", "الرصيد الفعلي (الجرد)", "number"),
          f("variance_value", "قيمة الفروقات (عجز/زيادة)", "number"),
          f("reasons", "أسباب الفروقات"),
        ],
      },
      {
        key: "Warehouses_Obsolete",
        label: "المواد الراكدة والتالفة",
        fields: [
          f("item_no", "رقم الصنف"),
          f("name", "اسم المادة"),
          f("in_date", "تاريخ الإدخال", "date"),
          f("qty", "الكمية الراكدة/التالفة", "number"),
          f("book_value", "القيمة الدفترية", "number"),
          f("reasons", "أسباب الركود والتلف"),
          f("writeoff", "قرار الشطب"),
        ],
      },
    ],
  },
  {
    key: "advances",
    label: "أنشطة وعمليات السلف المالية",
    en: "Financial Advances Activities & Operations",
    goal: "متابعة الذمم، السلف المؤقتة والمستديمة، وضمان تسويتها القانونية.",
    datasets: [
      {
        key: "Advances_Temporary",
        label: "السلف المؤقتة",
        fields: [
          f("advance_no", "رقم السلفة / السند"),
          f("employee", "اسم الموظف المستفيد"),
          f("department", "القسم"),
          f("purpose", "الغرض من السلفة"),
          f("amount", "المبلغ المصروف", "number"),
          f("paid_date", "تاريخ الصرف", "date"),
          f("due_date", "تاريخ الاستحقاق القانوني", "date"),
        ],
      },
      {
        key: "Advances_Settlements",
        label: "تسويات السلف",
        fields: [
          f("advance_no", "رقم السلفة الأصلية"),
          f("date", "تاريخ تقديم التسوية", "date"),
          f("invoices", "قيمة الفواتير والمستندات", "number"),
          f("refund", "قيمة الفائض المرتجع", "number"),
          f("receipt_no", "رقم سند القبض للفائض"),
          f("remaining", "رصيد السلفة المتبقي", "number"),
        ],
      },
      {
        key: "Advances_Permanent_Petty",
        label: "السلف المستديمة",
        fields: [
          f("advance_no", "رقم السلفة المستديمة"),
          f("custodian", "أمين الصندوق المسؤول"),
          f("approved", "القيمة المعتمدة", "number"),
          f("spent", "إجمالي المصروف خلال الشهر", "number"),
          f("cash", "رصيد النقدية", "number"),
          f("replenish_date", "تاريخ طلب الاستعاضة", "date"),
        ],
      },
      {
        key: "Advances_Overdue_Outstanding",
        label: "الذمم المتأخرة",
        fields: [
          f("advance_no", "رقم السلفة"),
          f("beneficiary", "اسم المستفيد"),
          f("amount", "المبلغ المتأخر", "number"),
          f("days", "عدد أيام التأخير", "number"),
          f("actions", "الإجراءات القانونية والإدارية المتخذة"),
        ],
      },
    ],
  },
  {
    key: "procurement",
    label: "أنشطة وعمليات المشتريات وأوامر الشراء",
    en: "Procurement & Purchase Orders Activities & Operations",
    goal: "ضبط أوامر الشراء والمشتريات المباشرة وصلاحيات الموافقة عليها.",
    datasets: [
      {
        key: "Direct_Purchases_Orders",
        label: "أوامر الشراء والمشتريات المباشرة",
        fields: [
          f("po_no", "رقم أمر الشراء"),
          f("date", "التاريخ", "date"),
          f("supplier", "اسم المورد"),
          f("nature", "طبيعة المشتريات / المواد"),
          f("value", "القيمة", "number"),
          f("method", "طريقة الشراء"),
          f("approver", "صاحب الصلاحية الموافق"),
          f("entered_by", "مُدخل أمر الشراء"),
          f("received_by", "مستلم المواد"),
          f("supplier_phone", "هاتف المورد"),
          f("supplier_address", "عنوان المورد"),
          f("supplier_bank", "الحساب البنكي للمورد"),
          f("supplier_national_id", "الرقم الوطني للمورد (إن كان فرداً)"),
        ],
      },
    ],
  },
  {
    key: "tenders",
    label: "أنشطة وعمليات العطاءات",
    en: "Tenders Activities & Operations",
    goal: "متابعة سجلات العطاءات والمشتريات الكبرى وسلامة إجراءات الطرح والإحالة.",
    datasets: [
      {
        key: "Tenders_Records",
        label: "سجلات العطاءات والمشتريات الكبرى",
        fields: [
          f("tender_no", "رقم العطاء"),
          f("date", "تاريخ الطرح", "date"),
          f("subject", "موضوع العطاء"),
          f("estimated_value", "القيمة التقديرية", "number"),
          f("awarded_value", "قيمة الإحالة", "number"),
          f("winner", "الجهة المحال عليها"),
          f("bidders", "عدد المتقدمين", "number"),
          f("committee", "لجنة العطاءات"),
          f("status", "الحالة"),
          f("winner_phone", "هاتف الجهة المحال عليها"),
          f("winner_address", "عنوان الجهة المحال عليها"),
          f("winner_bank", "الحساب البنكي للجهة المحال عليها"),
          f("winner_national_id", "الرقم الوطني للجهة المحال عليها (إن كانت فرداً)"),
        ],
      },
      {
        key: "Engineering_BoQ_Master",
        label: "جداول الكميات والأسعار (BoQ)",
        fields: [
          f("project_no", "رقم المشروع"),
          f("project_name", "اسم المشروع"),
          f("item_no", "رقم البند"),
          f("description", "وصف البند"),
          f("unit", "الوحدة"),
          f("quantity", "الكمية الأصلية", "number"),
          f("unit_price", "سعر الوحدة", "number"),
          f("total", "إجمالي البند", "number"),
          f("contract_value", "قيمة العقد", "number"),
        ],
      },
      {
        key: "Engineering_Site_Handover_Minutes",
        label: "محاضر تسليم الموقع",
        fields: [
          f("project_no", "رقم المشروع"),
          f("contractor", "المقاول"),
          f("handover_date", "تاريخ تسليم الموقع", "date"),
          f("commencement_date", "تاريخ المباشرة العقدية", "date"),
          f("contract_days", "مدة العقد (يوم)", "number"),
          f("minutes_no", "رقم المحضر"),
          f("signed_by", "الموقعون على المحضر"),
        ],
      },
      {
        key: "Engineering_Progress_Payments",
        label: "المستخلصات الهندسية",
        fields: [
          f("project_no", "رقم المشروع"),
          f("payment_no", "رقم المستخلص"),
          f("date", "تاريخ المستخلص", "date"),
          f("type", "نوع المستخلص (مرحلي / نهائي)"),
          f("item_no", "رقم بند الكميات"),
          f("executed_qty", "الكمية المنفذة", "number"),
          f("paid_amount", "المبلغ المصروف", "number"),
          f("cumulative_paid", "المصروف التراكمي", "number"),
          f("progress_pct", "نسبة الإنجاز الفعلي %", "number"),
          f("delay_penalty", "غرامة التأخير المحتسبة", "number"),
          f("engineer", "المهندس المشرف"),
        ],
      },
      {
        key: "Engineering_Time_Extensions_Variations",
        label: "تمديدات المدة وأوامر التغيير",
        fields: [
          f("project_no", "رقم المشروع"),
          f("request_no", "رقم الطلب / أمر التغيير"),
          f("type", "النوع (تمديد مدة / أمر تغيير)"),
          f("date", "التاريخ", "date"),
          f("extension_days", "أيام التمديد", "number"),
          f("variation_value", "قيمة أمر التغيير", "number"),
          f("approved", "معتمد (نعم / لا)"),
          f("approved_by", "جهة الاعتماد"),
          f("reason", "السبب"),
        ],
      },
    ],
  },
];
var allDatasets = auditSectors.flatMap((s) =>
  s.datasets.map((d) => ({
    ...d,
    sector: s.key,
  })),
);
var defaultParams = {
  depositGraceDays: 1,
  staleChequeDays: 180,
  materialityPct: 1,
  reviewIntervalDays: 90,
  overtimeMaxHours: 0,
  fuelTolerancePct: 2,
  contractFuelPrice: 0,
  workStartHour: 7,
  workEndHour: 15,
  licenseWarnDays: 30,
  maintenanceMultiple: 3,
  directPurchaseCeiling: 0,
  splitWindowDays: 7,
  concentrationPct: 25,
  committeeRotationMax: 3,
  stagnantMonths: 12,
  overtimeConcentrationPct: 30,
};
var n = (v) => {
  const x = Number(
    String(v ?? "")
      .replaceAll(",", "")
      .trim(),
  );
  return String(v ?? "").trim() === "" || !Number.isFinite(x) ? void 0 : x;
};
var d = (v) => parseDateMs(v);
var empty = (v) => !String(v ?? "").trim();
var yes = (v) =>
  /^(نعم|yes|y|true|1|نعم يوجد|يوجد|متجاوز|تجاوز)$/i.test(
    String(v ?? "").trim(),
  );
var no = (v) =>
  /^(لا|no|n|false|0|غير مطابق|لا يطابق)$/i.test(String(v ?? "").trim());
var DAY = 864e5;
var near = (a, b) => Math.abs(a - b) < 0.005;
var norm$1 = (s) =>
  String(s ?? "")
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
var days = (a, b) => Math.floor((a - b) / DAY);
var isCash = (v) => /نقد|cash/i.test(String(v ?? ""));
var isCheque = (v) => /شيك|cheque|check/i.test(String(v ?? ""));
var isCancelled = (r) => /ملغ|[اإ]لغ|cancel|void/i.test(String(r.status ?? ""));
var isReturned = (v) =>
  /بدون رصيد|رصيد غير كاف|مرتج|راجع|مرتد|مرفوض|return|bounc|nsf|dishonou?r/i.test(
    String(v ?? ""),
  );
var inactiveStatus = (v) =>
  /منقطع|موقوف|مستقيل|متقاعد|مفصول|متوف|terminated|resigned|retired|suspended|absent|deceased/i.test(
    String(v ?? ""),
  );
var placeholder = (v) =>
  /^(-+|—|لا يوجد|لايوجد|تم|تم الانجاز|تم الإنجاز|منجز|نفذ|ok|n\/?a|na|none|null)$/i.test(
    String(v ?? "").trim(),
  );
var tier = (amount, base, pct) => {
  if (!(base > 0)) return "high";
  const r = (Math.abs(amount) / base) * 100;
  return r <= pct ? "low" : r <= pct * 5 ? "medium" : "high";
};
var atLeast = (s, min) =>
  ({
    low: 0,
    medium: 1,
    high: 2,
  })[s] >=
  {
    low: 0,
    medium: 1,
    high: 2,
  }[min]
    ? s
    : min;
var quart = (s, p) => {
  const pos = (s.length - 1) * p,
    lo = Math.floor(pos),
    hi = Math.ceil(pos);
  return (s[lo] ?? 0) + ((s[hi] ?? 0) - (s[lo] ?? 0)) * (pos - lo);
};
var fences = (vals) => {
  if (vals.length < 4) return void 0;
  const s = [...vals].sort((a, b) => a - b),
    q1 = quart(s, 0.25),
    q3 = quart(s, 0.75),
    iqr = q3 - q1;
  return iqr > 0
    ? {
        mid: q3 + 1.5 * iqr,
        far: q3 + 3 * iqr,
      }
    : void 0;
};
var outlier = (v, f) =>
  f ? (v > f.far ? "high" : v > f.mid ? "medium" : void 0) : void 0;
var groupBy = (items, key) => {
  const m = /* @__PURE__ */ new Map();
  items.forEach((x) => {
    const k = key(x);
    if (k) m.set(k, [...(m.get(k) ?? []), x]);
  });
  return m;
};
var val = (r, k) => r[k];
function duplicates(rows, key, push, label) {
  const seen = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const k = String(val(r, key) ?? "").trim();
    if (!k) return;
    if (seen.has(k))
      push(
        i,
        "high",
        `تكرار ${label}`,
        `الرقم ${k} مكرر مع السجل ${seen.get(k) + 1}`,
      );
    else seen.set(k, i);
  });
}
function required(rows, keys, push, severity = "medium") {
  rows.forEach((r, i) =>
    keys.forEach(([k, l]) => {
      if (empty(r[k])) push(i, severity, "حقل جوهري ناقص", `لم يُدخل: ${l}`);
    }),
  );
}
function sequence(rows, push, label) {
  groupBy(
    rows.flatMap((r, i) => {
      const m = /^(.*?)(\d+)\s*$/.exec(String(r.voucher_no ?? "").trim());
      return m
        ? [
            {
              i,
              prefix: norm$1(m[1]),
              num: Number(m[2]),
              t: d(r.date),
            },
          ]
        : [];
    }),
    (x) => `p:${x.prefix}`,
  ).forEach((list) => {
    const sorted = [...list].sort((a, b) => a.num - b.num || a.i - b.i);
    let lastDate;
    sorted.forEach((cur, k) => {
      const prev = sorted[k - 1];
      if (prev && cur.num > prev.num + 1) {
        const gap = cur.num - prev.num - 1;
        push(
          cur.i,
          gap >= 3 ? "high" : "medium",
          `انقطاع في تسلسل ${label}`,
          `مفقود ${gap} سند بين ${prev.num} و ${cur.num}`,
        );
      }
      if (cur.t !== void 0) {
        if (lastDate !== void 0 && cur.t < lastDate) {
          const back = Math.round((lastDate - cur.t) / DAY);
          push(
            cur.i,
            back <= 1 ? "low" : "medium",
            "تاريخ السند أسبق من سند أقل رقماً",
            `${back} يوم`,
          );
        }
        lastDate = Math.max(lastDate ?? cur.t, cur.t);
      }
    });
  });
}
function cancellations(rows, push, label, party) {
  rows.forEach((r, i) => {
    if (!isCancelled(r)) return;
    if (empty(r.cancel_reason))
      push(i, "high", `سند ${label} ملغى دون سبب موثق`, r.voucher_no ?? "");
    else push(i, "low", `سند ${label} ملغى`, r.cancel_reason);
  });
  groupBy(
    rows.flatMap((r, i) =>
      isCancelled(r)
        ? [
            {
              i,
              k: norm$1(party(r)),
            },
          ]
        : [],
    ),
    (x) => x.k,
  ).forEach((list) => {
    if (list.length >= 2)
      list
        .slice(1)
        .forEach((x) =>
          push(
            x.i,
            "medium",
            `تكرار إلغاء سندات ${label} لنفس الطرف`,
            `${list.length} سندات ملغاة`,
          ),
        );
  });
}
function receipts(rows, push, p, today, by) {
  const tb = by("Trial_Balance"),
    clearing = by("Clearing_Accounts");
  duplicates(rows, "voucher_no", push, "رقم سند القبض");
  sequence(rows, push, "سندات القبض");
  cancellations(rows, push, "القبض", (r) => r.payer);
  rows.forEach((r, i) => {
    if (
      isCancelled(r) &&
      (!empty(r.deposit_date) || (n(r.deposited_amount) ?? 0) > 0)
    )
      push(i, "high", "سند قبض ملغى له إيداع مسجل", r.deposit_date ?? "");
  });
  const live = rows.flatMap((r, i) =>
    isCancelled(r)
      ? []
      : [
          {
            r,
            i,
          },
        ],
  );
  live.forEach(({ r, i }) => {
    if (n(r.amount) === void 0) push(i, "medium", "حقل جوهري ناقص", "لم يُدخل: المبلغ المقبوض");
    if (empty(r.date)) push(i, "medium", "حقل جوهري ناقص", "لم يُدخل: تاريخ القبض");
    if (empty(r.payer)) push(i, "medium", "حقل جوهري ناقص", "لم يُدخل: المقبوض منه");
    if (empty(r.method)) push(i, "medium", "طريقة القبض غير مسجلة", "");
  });
  const grace = Math.max(1, Math.floor(p.depositGraceDays) || 1);
  live.forEach(({ r, i }) => {
    const cash = isCash(r.method),
      chq = isCheque(r.method);
    const t = d(r.date),
      dd = d(r.deposit_date),
      am = n(r.amount),
      da = n(r.deposited_amount);
    if ((cash || chq) && t !== void 0)
      if (dd !== void 0 && dd < t)
        push(
          i,
          "high",
          "تاريخ الإيداع يسبق تاريخ القبض",
          `${r.deposit_date} قبل ${r.date}`,
        );
      else {
        const delay = days(dd ?? today, t);
        if (delay > grace)
          push(
            i,
            delay <= grace * 2 ? "low" : delay <= grace * 5 ? "medium" : "high",
            dd === void 0
              ? cash
                ? "نقدية غير مودعة بعد تجاوز المهلة"
                : "شيك غير مودع بعد تجاوز المهلة"
              : cash
                ? "تأخر توريد النقدية للبنك"
                : "تأخر إيداع الشيك",
            `${delay} يوم والمهلة ${grace}`,
          );
      }
    if (dd !== void 0 || da !== void 0) {
      if (da === void 0) push(i, "low", "مبلغ الإيداع غير مسجل", "");
      else {
        if (dd === void 0)
          push(i, "medium", "مبلغ مودع دون تاريخ إيداع", String(da));
        if (am !== void 0 && !near(am, da))
          if (da < am)
            push(
              i,
              atLeast(tier(am - da, am, p.materialityPct), "medium"),
              "نقص في المبلغ المودع عن المقبوض",
              `المقبوض ${am} والمودع ${da}`,
            );
          else
            push(
              i,
              "medium",
              "المبلغ المودع يزيد عن المقبوض",
              `المقبوض ${am} والمودع ${da}`,
            );
      }
      if (dd !== void 0 && empty(r.deposit_ref))
        push(i, "low", "إيداع بلا رقم إشعار بنكي", "");
    }
  });
  live.forEach(({ r, i }) => {
    if (isCheque(r.method) && empty(r.cheque_no))
      push(i, "medium", "قبض بشيك دون رقم الشيك", "");
    if (!isCheque(r.method) && !empty(r.cheque_no))
      push(i, "low", "رقم شيك مسجل مع طريقة قبض مختلفة", r.method ?? "");
  });
  groupBy(
    live.filter(({ r }) => !empty(r.cheque_no)),
    ({ r }) => norm$1(r.cheque_no),
  ).forEach((list) => {
    list
      .slice(1)
      .forEach(({ i }) =>
        push(
          i,
          "high",
          "رقم الشيك مستخدم في أكثر من سند",
          `${list.length} سندات`,
        ),
      );
  });
  groupBy(
    live.filter(
      ({ r }) => !empty(r.payer) && !empty(r.amount) && !empty(r.date),
    ),
    ({ r }) => `${norm$1(r.payer)}|${n(r.amount)}|${r.date}`,
  ).forEach((list) => {
    list
      .slice(1)
      .forEach(({ i }) =>
        push(
          i,
          "high",
          "احتمال قبض مزدوج",
          `نفس المقبوض منه والمبلغ والتاريخ مع السجل ${list[0].i + 1}`,
        ),
      );
  });
  const returnedByPayer = groupBy(
    rows.flatMap((r, i) =>
      isReturned(r.cheque_status) && !empty(r.payer)
        ? [
            {
              r,
              i,
            },
          ]
        : [],
    ),
    ({ r }) => norm$1(r.payer),
  );
  rows.forEach((r, i) => {
    if (!isReturned(r.cheque_status)) return;
    const k = norm$1(r.payer),
      count = k ? (returnedByPayer.get(k)?.length ?? 1) : 1,
      t = d(r.date) ?? 0,
      am = n(r.amount) ?? 0;
    const settled =
      Boolean(k) &&
      live.some(
        ({ r: o, i: j }) =>
          j !== i &&
          norm$1(o.payer) === k &&
          !isReturned(o.cheque_status) &&
          (d(o.date) ?? 0) >= t &&
          (n(o.amount) ?? 0) >= am,
      );
    push(
      i,
      count >= 2 ? "high" : isCancelled(r) || settled ? "low" : "medium",
      "شيك مرتجع أو بدون رصيد",
      count >= 2
        ? `تكرر ${count} مرات لنفس الساحب`
        : settled
          ? "سُوّي بسند لاحق"
          : isCancelled(r)
            ? "أُلغي السند"
            : "لم يُلغَ أثره ولم تتم تسويته",
    );
  });
  live.forEach(({ r, i }) => {
    if (!isCheque(r.method) || isReturned(r.cheque_status)) return;
    const k = norm$1(r.payer),
      t = d(r.date);
    if (!k || t === void 0) return;
    const prior = rows.filter(
      (o, j) =>
        j !== i &&
        norm$1(o.payer) === k &&
        isReturned(o.cheque_status) &&
        (d(o.date) ?? Infinity) < t,
    ).length;
    if (prior > 0)
      push(
        i,
        prior >= 2 ? "high" : "medium",
        "قبول شيك جديد من ساحب سبق ارتداد شيكه",
        `${prior} شيك مرتجع سابق`,
      );
  });
  const cashRe = /صندوق|نقدي|خزين|بنك|مصرف|cash|bank/i,
    suspRe = /وسيط|معلق|مؤقت|تسوية|clearing|suspense|temporary/i,
    personalRe = /سلف|عهد|موظف|شخصي|advance|employee|personal/i;
  const tbKeys = new Set(
    tb
      .flatMap((t) => [norm$1(t.account_no), norm$1(t.account_name)])
      .filter(Boolean),
  );
  const clrKeys = new Set(
    clearing
      .flatMap((c) => [norm$1(c.account_no), norm$1(c.account_name)])
      .filter(Boolean),
  );
  live.forEach(({ r, i }) => {
    const a = r.credit_account ?? "";
    if (empty(a)) {
      push(i, "high", "قبض دون حساب دائن", "");
      return;
    }
    const k = norm$1(a);
    if (clrKeys.has(k) || suspRe.test(a))
      push(i, "high", "تحويل المقبوض إلى حساب وسيط أو معلق", a);
    else if (cashRe.test(a))
      push(i, "high", "الحساب الدائن هو حساب نقدية أو بنك", a);
    else if (personalRe.test(a) && !personalRe.test(r.revenue_type ?? ""))
      push(i, "medium", "تحويل المقبوض إلى حساب سلف أو ذمم أشخاص دون مبرر", a);
    if (tb.length && !tbKeys.has(k))
      push(i, "medium", "الحساب الدائن غير موجود في ميزان المراجعة", a);
  });
  groupBy(
    live.filter(({ r }) => !empty(r.revenue_type) && !empty(r.credit_account)),
    ({ r }) => norm$1(r.revenue_type),
  ).forEach((list) => {
    if (list.length < 3) return;
    const counts = /* @__PURE__ */ new Map();
    list.forEach(({ r }) => {
      const k = norm$1(r.credit_account);
      counts.set(k, {
        n: (counts.get(k)?.n ?? 0) + 1,
        raw: counts.get(k)?.raw ?? r.credit_account,
      });
    });
    const [topKey, top] = [...counts.entries()].sort(
      (a, b) => b[1].n - a[1].n,
    )[0];
    const share = top.n / list.length;
    if (share < 0.5) return;
    list.forEach(({ r, i }) => {
      if (norm$1(r.credit_account) !== topKey)
        push(
          i,
          share >= 0.75 ? "medium" : "low",
          "حساب دائن مخالف للمعتاد لنفس نوع الإيراد",
          `المعتاد ${top.raw} بنسبة ${Math.round(share * 100)}%`,
        );
    });
  });
}
function payments(rows, push) {
  duplicates(rows, "voucher_no", push, "رقم سند الصرف");
  sequence(rows, push, "سندات الصرف");
  cancellations(rows, push, "الصرف", (r) => r.payee);
  required(
    rows,
    [
      ["payee", "الحساب المدفوع له"],
      ["budget_item", "بند الموازنة المقابل"],
      ["support_doc", "رقم المستند المعزز"],
    ],
    push,
  );
  const live = rows.flatMap((r, i) =>
    isCancelled(r)
      ? []
      : [
          {
            r,
            i,
          },
        ],
  );
  live.forEach(({ r, i }) => {
    const t = d(r.date);
    if (t !== void 0 && [5, 6].includes(new Date(t).getUTCDay()))
      push(i, "medium", "صرف في يوم عطلة", r.date);
    if (empty(r.approver)) push(i, "high", "صرف دون معتمد", "");
    else if (!empty(r.payee) && norm$1(r.approver) === norm$1(r.payee))
      push(i, "high", "معتمد الصرف هو نفسه المستفيد", r.approver);
  });
  groupBy(
    live.filter(({ r }) => !empty(r.payee) && !empty(r.amount)),
    ({ r }) => `${norm$1(r.payee)}|${n(r.amount)}|${r.date}`,
  ).forEach((list) => {
    list
      .slice(1)
      .forEach(({ i }) =>
        push(
          i,
          "high",
          "احتمال صرف مزدوج",
          `نفس المستفيد والمبلغ والتاريخ مع السجل ${list[0].i + 1}`,
        ),
      );
  });
  groupBy(
    live.filter(({ r }) => !empty(r.payee) && !empty(r.date)),
    ({ r }) => `${norm$1(r.payee)}|${r.date}`,
  ).forEach((list) => {
    if (list.length > 1 && new Set(list.map(({ r }) => n(r.amount))).size > 1)
      list.forEach(({ i }) =>
        push(
          i,
          "medium",
          "احتمال تجزئة الصرف",
          `${list.length} سندات لنفس المستفيد في نفس اليوم`,
        ),
      );
  });
}
function bankReconciliations(rows, push, p, today, by) {
  rows.forEach((r, i) => {
    const bank = n(r.bank_balance),
      book = n(r.book_balance),
      oc = n(r.outstanding_checks) ?? 0,
      dit = n(r.deposits_in_transit) ?? 0;
    const charges = n(r.bank_charges) ?? 0,
      credits = n(r.unrecorded_credits) ?? 0,
      diff = n(r.difference);
    const base = Math.abs(bank ?? book ?? 0);
    if (bank !== void 0 && book !== void 0) {
      const u = bank - oc + dit - (book + credits - charges);
      if (!near(u, 0))
        push(
          i,
          tier(u, base, p.materialityPct),
          "فرق تسوية غير مبرر",
          `الرصيد المعدل للبنك يختلف عن الدفاتر بمقدار ${u.toFixed(2)}`,
        );
      if (diff !== void 0 && !near(diff, u))
        push(
          i,
          "medium",
          "الفرق المسجل لا يطابق المحسوب",
          `المسجل ${diff} والمحسوب ${u.toFixed(2)}`,
        );
    } else if (diff !== void 0 && !near(diff, 0))
      push(
        i,
        tier(diff, base, p.materialityPct),
        "فروقات تسوية قائمة",
        String(diff),
      );
    if (oc > 0) {
      const od = d(r.oldest_check_date);
      if (od === void 0) push(i, "low", "تاريخ أقدم شيك معلق غير مدخل", "");
      else {
        const age = days(today, od);
        if (age > p.staleChequeDays)
          push(
            i,
            age > p.staleChequeDays * 2 ? "high" : "medium",
            "شيكات معلقة متقادمة",
            `${age} يوم`,
          );
      }
    }
    if (charges > 0)
      push(
        i,
        "low",
        "عمولات ومصاريف بنكية غير مسجلة بالدفاتر",
        String(charges),
      );
    if (credits > 0)
      push(
        i,
        atLeast(tier(credits, base, p.materialityPct), "medium"),
        "إيداعات بنكية غير مسجلة بالدفاتر",
        String(credits),
      );
    if (empty(r.reviewed_by)) push(i, "medium", "تسوية دون مراجعة", "");
    else if (
      !empty(r.prepared_by) &&
      norm$1(r.prepared_by) === norm$1(r.reviewed_by)
    )
      push(i, "high", "معد التسوية هو نفسه المراجع", r.prepared_by);
  });
  groupBy(
    rows.filter((r) => !empty(r.bank_account) && !empty(r.statement_date)),
    (r) => `${norm$1(r.bank_account)}|${r.statement_date}`,
  ).forEach((list) => {
    list
      .slice(1)
      .forEach((r) =>
        push(
          rows.indexOf(r),
          "medium",
          "تسوية مكررة لنفس الحساب والتاريخ",
          r.bank_account ?? "",
        ),
      );
  });
  const rc = by("Receipt_Vouchers");
  if (rc.length)
    groupBy(
      rows.flatMap((r, i) =>
        d(r.statement_date) !== void 0
          ? [
              {
                r,
                i,
              },
            ]
          : [],
      ),
      ({ r }) => String(d(r.statement_date)),
    ).forEach((list, key) => {
      const cut = Number(key);
      const transit = list.reduce(
        (a, { r }) => a + (n(r.deposits_in_transit) ?? 0),
        0,
      );
      const pending = rc.reduce((a, r) => {
        const t = d(r.date);
        if (
          isCancelled(r) ||
          t === void 0 ||
          t > cut ||
          !(isCash(r.method) || isCheque(r.method))
        )
          return a;
        const dd = d(r.deposit_date);
        return dd === void 0 || dd > cut ? a + (n(r.amount) ?? 0) : a;
      }, 0);
      if (!near(transit, pending))
        push(
          list[0].i,
          tier(transit - pending, Math.max(transit, pending), p.materialityPct),
          "الإيداعات بالطريق لا تطابق المقبوضات غير المودعة في سندات القبض",
          `بالتسوية ${transit} وبسندات القبض ${pending}`,
        );
    });
}
function pettyCash(rows, push, p, today) {
  duplicates(rows, "box", push, "رقم الصندوق");
  rows.forEach((r, i) => {
    const ap = n(r.approved),
      ac = n(r.actual),
      un = n(r.unsettled_docs) ?? 0;
    if (ap !== void 0 && ac !== void 0) {
      const diff = ac + un - ap;
      if (!near(diff, 0)) {
        const s = tier(diff, ap, p.materialityPct);
        push(
          i,
          diff < 0 ? s : s === "high" ? "medium" : s,
          diff < 0 ? "عجز في العهدة النقدية" : "زيادة في العهدة النقدية",
          `الفعلي + المستندات = ${ac + un} مقابل المعتمد ${ap}`,
        );
      }
      if (ac > ap) push(i, "medium", "الرصيد الفعلي يتجاوز المعتمد", "");
      if (un > ap)
        push(
          i,
          "high",
          "المستندات غير المسواة تتجاوز العهدة المعتمدة",
          `${un} مقابل ${ap}`,
        );
    }
    const lc = d(r.last_count);
    if (empty(r.last_count)) push(i, "medium", "لا يوجد جرد مفاجئ مسجل", "");
    else if (lc !== void 0) {
      const age = days(today, lc);
      if (age < 0) push(i, "high", "تاريخ جرد مستقبلي", r.last_count);
      else if (age > p.reviewIntervalDays)
        push(
          i,
          age > p.reviewIntervalDays * 2 ? "high" : "medium",
          "جرد مفاجئ متأخر",
          `${age} يوم`,
        );
      if (empty(r.counted_by)) push(i, "low", "القائم بالجرد غير مسجل", "");
      else if (
        norm$1(r.box).includes(norm$1(r.counted_by)) &&
        norm$1(r.counted_by).length >= 3
      )
        push(i, "high", "أمين الصندوق هو من أجرى الجرد", r.counted_by);
    }
    const lr = d(r.last_replenish);
    if (un > 0) {
      if (lr === void 0)
        push(i, "low", "لا توجد استعاضة مسجلة رغم وجود مستندات غير مسواة", "");
      else if (days(today, lr) > p.reviewIntervalDays)
        push(
          i,
          "medium",
          "مستندات غير مسواة دون استعاضة ضمن المدة",
          `${days(today, lr)} يوم`,
        );
    }
  });
}
function payroll(rows, push, p, today, by) {
  const est = by("HR_Establishment_Table"),
    promos = by("HR_Promotions_Increments");
  duplicates(rows, "employee_no", push, "الرقم الوظيفي (موظف وهمي أو مكرر)");
  const sameOther = (key, label, severity) =>
    groupBy(
      rows.flatMap((r, i) =>
        empty(val(r, key))
          ? []
          : [
              {
                r,
                i,
              },
            ],
      ),
      ({ r }) => norm$1(val(r, key)),
    ).forEach((list) => {
      const firstNo = norm$1(list[0].r.employee_no);
      list.slice(1).forEach(({ r, i }) => {
        if (norm$1(r.employee_no) !== firstNo)
          push(i, severity, label, `نفس القيمة مع السجل ${list[0].i + 1}`);
      });
    });
  sameOther("national_id", "الرقم الوطني مرتبط بأكثر من رقم وظيفي", "high");
  sameOther("bank_account", "حساب بنكي مشترك بين أكثر من موظف", "high");
  sameOther("name", "اسم مكرر بأرقام وظيفية مختلفة", "medium");
  rows.forEach((r, i) => {
    const b = n(r.basic),
      a = n(r.allowances) ?? 0,
      net = n(r.net),
      att = n(r.attendance_days),
      hd = d(r.hire_date);
    if (empty(r.appointment_decision))
      push(i, "high", "تعيين بلا قرار تعيين", "");
    if (empty(r.national_id)) push(i, "medium", "الرقم الوطني غير مدخل", "");
    if (empty(r.bank_account)) push(i, "medium", "الحساب البنكي غير مدخل", "");
    if (empty(r.hire_date)) push(i, "medium", "تاريخ التعيين غير مدخل", "");
    else if (hd !== void 0 && hd > today)
      push(i, "high", "تاريخ تعيين مستقبلي", r.hire_date);
    if (inactiveStatus(r.status) && (net ?? 0) > 0)
      push(i, "high", "صرف راتب لموظف حالته غير نشطة", r.status);
    if (att === 0 && (net ?? 0) > 0)
      push(i, "high", "راتب دون أي أيام حضور", "");
    else if (att === void 0) push(i, "low", "أيام الحضور غير مسجلة", "");
    if (b !== void 0 && net !== void 0 && net > b + a)
      push(i, "high", "الصافي أعلى من الأساسي + العلاوات", `${net} > ${b + a}`);
    if (a > 0 && (b === void 0 || b <= 0))
      push(i, "medium", "علاوات دون راتب أساسي", String(a));
  });
  groupBy(
    rows.flatMap((r, i) =>
      norm$1(r.grade) && (n(r.basic) ?? 0) > 0
        ? [
            {
              r,
              i,
            },
          ]
        : [],
    ),
    ({ r }) => norm$1(r.grade),
  ).forEach((list) => {
    const ratios = list.map(({ r }) => (n(r.allowances) ?? 0) / n(r.basic)),
      rf = fences(ratios),
      bf = fences(list.map(({ r }) => n(r.basic)));
    list.forEach(({ r, i }, k) => {
      const rs = outlier(ratios[k], rf),
        bs = outlier(n(r.basic), bf);
      if (rs)
        push(
          i,
          rs,
          "نسبة العلاوات إلى الأساسي شاذة مقارنة بنفس الدرجة",
          `${(ratios[k] * 100).toFixed(1)}%`,
        );
      if (bs)
        push(
          i,
          "medium",
          "الراتب الأساسي أعلى من نظرائه في نفس الدرجة",
          String(r.basic),
        );
    });
  });
  const promoByEmp = groupBy(promos, (x) => norm$1(x.employee_no));
  rows.forEach((r, i) => {
    const list = promoByEmp.get(norm$1(r.employee_no));
    if (!list?.length || empty(r.grade)) return;
    const dated = list
      .map((x) => ({
        x,
        t: d(x.due_date),
      }))
      .filter((x) => x.t !== void 0)
      .sort((a, b) => a.t - b.t);
    const due = dated.filter((x) => x.t <= today).at(-1);
    if (
      due &&
      !empty(due.x.new_grade) &&
      norm$1(due.x.new_grade) !== norm$1(r.grade)
    )
      push(
        i,
        "medium",
        "الدرجة في كشف الرواتب لا تطابق آخر قرار ترقية",
        `${r.grade} مقابل ${due.x.new_grade}`,
      );
    const future = dated.find(
      (x) => x.t > today && norm$1(x.x.new_grade) === norm$1(r.grade),
    );
    if (future)
      push(
        i,
        "high",
        "درجة ترقية مطبقة قبل تاريخ الاستحقاق",
        future.x.due_date ?? "",
      );
  });
  if (!est.length) return;
  const byPos = new Map(
    est
      .filter((e) => !empty(e.position_no))
      .map((e) => [norm$1(e.position_no), e]),
  );
  const holders = groupBy(
    rows.flatMap((r, i) =>
      empty(r.position_no)
        ? []
        : [
            {
              r,
              i,
            },
          ],
    ),
    ({ r }) => norm$1(r.position_no),
  );
  const counts = /* @__PURE__ */ new Map();
  est.forEach((e) =>
    counts.set(norm$1(e.title), (counts.get(norm$1(e.title)) ?? 0) + 1),
  );
  const used = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const annual = ((n(r.basic) ?? 0) + (n(r.allowances) ?? 0)) * 12;
    let allocation;
    if (!empty(r.position_no)) {
      const pos = byPos.get(norm$1(r.position_no));
      if (!pos)
        push(i, "high", "رقم الوظيفة غير موجود في التشكيلات", r.position_no);
      else {
        if (
          !empty(r.title) &&
          !empty(pos.title) &&
          norm$1(pos.title) !== norm$1(r.title)
        )
          push(
            i,
            "high",
            "المسمى لا يطابق المسمى المعتمد للوظيفة",
            `${r.title} مقابل ${pos.title}`,
          );
        if (
          !empty(r.grade) &&
          !empty(pos.grade) &&
          norm$1(pos.grade) !== norm$1(r.grade)
        )
          push(
            i,
            "high",
            "الدرجة الممنوحة تخالف الدرجة المقررة",
            `${r.grade} مقابل ${pos.grade}`,
          );
        allocation = n(pos.annual_allocation);
      }
      const h = holders.get(norm$1(r.position_no));
      if (h && h.length > 1 && h[0].i !== i)
        push(
          i,
          "high",
          "وظيفة واحدة مشغولة بأكثر من موظف",
          `${h.length} موظفين`,
        );
    } else if (!empty(r.title)) {
      const m = est.filter((e) => norm$1(e.title) === norm$1(r.title));
      if (!m.length)
        push(i, "high", "مسمى وظيفي غير موجود في التشكيلات", r.title);
      else {
        if (
          !empty(r.grade) &&
          !m.some((e) => norm$1(e.grade) === norm$1(r.grade))
        )
          push(
            i,
            "high",
            "الدرجة الممنوحة تخالف الدرجة المقررة",
            `${r.grade} مقابل ${m.map((e) => e.grade).join("، ")}`,
          );
        const k = norm$1(r.title);
        used.set(k, (used.get(k) ?? 0) + 1);
        if (used.get(k) > (counts.get(k) ?? 0))
          push(i, "high", "تعيين يتجاوز الشواغر المعتمدة", r.title);
        const allocs = m
          .map((e) => n(e.annual_allocation))
          .filter((x) => x !== void 0);
        if (allocs.length) allocation = Math.max(...allocs);
      }
    }
    if (allocation !== void 0 && allocation > 0 && annual > allocation)
      push(
        i,
        tier(annual - allocation, allocation, p.materialityPct),
        "الراتب السنوي المقدر يتجاوز المخصص المعتمد",
        `${annual} مقابل ${allocation}`,
      );
  });
}
function overtime(rows, push, p, by) {
  const payrollRows = by("HR_Payroll_Sheets");
  const usesApproval = rows.some((r) => !empty(r.approved_hours));
  const deptFences = /* @__PURE__ */ new Map();
  groupBy(
    rows.filter((r) => (n(r.hours) ?? 0) > 0),
    (r) => norm$1(r.department) || "-",
  ).forEach((list, k) =>
    deptFences.set(k, fences(list.map((r) => n(r.hours)))),
  );
  const rateFences = fences(
    rows.flatMap((r) =>
      (n(r.overtime_pay) ?? 0) > 0 && (n(r.hours) ?? 0) > 0
        ? [n(r.overtime_pay) / n(r.hours)]
        : [],
    ),
  );
  rows.forEach((r, i) => {
    const h = n(r.hours) ?? 0,
      ap = n(r.approved_hours),
      bio = n(r.biometric_hours),
      pay = n(r.overtime_pay) ?? 0;
    if (empty(r.report))
      push(i, "high", "مكافأة أو إضافي بدون تقرير إنجاز", "");
    else if (placeholder(r.report) || norm$1(r.report).length < 8)
      push(i, "medium", "تقرير إنجاز شكلي أو غير مفصل", r.report);
    if ((n(r.bonus) ?? 0) > 0 && h === 0)
      push(i, "medium", "مكافأة دون ساعات عمل إضافي مسجلة", "");
    if (pay > 0 && h === 0)
      push(i, "high", "صرف مقابل إضافي دون ساعات", String(pay));
    if (
      payrollRows.length &&
      !empty(r.employee_no) &&
      !payrollRows.some((x) => norm$1(x.employee_no) === norm$1(r.employee_no))
    )
      push(i, "high", "موظف غير موجود في كشف الرواتب", r.employee_no);
    if (usesApproval) {
      if (ap === void 0 && h > 0)
        push(i, "medium", "إضافي بلا اعتماد مسبق للساعات", "");
      else if (ap !== void 0 && h > ap)
        push(
          i,
          atLeast(tier(h - ap, ap, p.materialityPct), "medium"),
          "ساعات إضافي تتجاوز المعتمدة مسبقاً",
          `${h} مقابل ${ap}`,
        );
    }
    if (bio !== void 0 && h > bio)
      push(
        i,
        bio === 0
          ? "high"
          : atLeast(tier(h - bio, bio, p.materialityPct), "medium"),
        bio === 0
          ? "إضافي دون أي ساعات مثبتة بالبصمة"
          : "ساعات إضافي تتجاوز المثبتة بالبصمة",
        `${h} مقابل ${bio}`,
      );
    const hs =
      h > 0 ? outlier(h, deptFences.get(norm$1(r.department) || "-")) : void 0;
    if (hs) push(i, hs, "تضخم ساعات الإضافي مقارنة بنظراء القسم", String(h));
    if (p.overtimeMaxHours > 0 && h > p.overtimeMaxHours)
      push(
        i,
        "high",
        "ساعات الإضافي تتجاوز الحد الأقصى المحدد",
        `${h} مقابل ${p.overtimeMaxHours}`,
      );
    if (pay > 0 && h > 0) {
      const rs = outlier(pay / h, rateFences);
      if (rs)
        push(
          i,
          rs,
          "قيمة الساعة الإضافية شاذة مقارنة بالسجلات",
          (pay / h).toFixed(2),
        );
    }
  });
  groupBy(rows, (r) =>
    empty(r.employee_no) ? "" : `${norm$1(r.employee_no)}|${norm$1(r.period)}`,
  ).forEach((list) => {
    if (list.length < 2) return;
    const idx = list.map((r) => rows.indexOf(r));
    const total = list.reduce((a, r) => a + (n(r.hours) ?? 0), 0);
    const projects = groupBy(list, (r) => norm$1(r.project) || "-");
    const reports = groupBy(
      list.filter((r) => !empty(r.report) && !placeholder(r.report)),
      (r) => norm$1(r.report),
    );
    projects.forEach((same) =>
      same
        .slice(1)
        .forEach((r) =>
          push(
            rows.indexOf(r),
            "high",
            "ازدواج صرف: نفس الموظف والمشروع والفترة",
            `${same.length} سجلات`,
          ),
        ),
    );
    if (projects.size >= 2)
      idx.forEach((i) =>
        push(
          i,
          projects.size >= 3 ? "high" : "medium",
          "صرف إضافي لنفس الموظف عن أكثر من مشروع في نفس الفترة",
          `${projects.size} مشاريع بمجموع ${total} ساعة`,
        ),
      );
    reports.forEach((same) => {
      if (new Set(same.map((r) => norm$1(r.project) || "-")).size >= 2)
        same.forEach((r) =>
          push(
            rows.indexOf(r),
            "high",
            "نفس تقرير الإنجاز مستخدم لمشاريع مختلفة",
            r.employee_no,
          ),
        );
    });
    if (total > 744)
      idx.forEach((i) =>
        push(
          i,
          "high",
          "مجموع الإضافي يتجاوز ساعات الشهر الفعلية",
          `${total} ساعة`,
        ),
      );
    else if (p.overtimeMaxHours > 0 && total > p.overtimeMaxHours)
      idx.forEach((i) =>
        push(
          i,
          "high",
          "مجموع الإضافي عبر المشاريع يتجاوز الحد الأقصى",
          `${total} مقابل ${p.overtimeMaxHours}`,
        ),
      );
  });
  groupBy(
    rows.filter(
      (r) =>
        !empty(r.report) &&
        !placeholder(r.report) &&
        norm$1(r.report).length >= 8,
    ),
    (r) => norm$1(r.report),
  ).forEach((list) => {
    if (new Set(list.map((r) => norm$1(r.employee_no))).size < 2) return;
    const crossProject =
      new Set(list.map((r) => norm$1(r.project) || "-")).size >= 2;
    list.forEach((r) =>
      push(
        rows.indexOf(r),
        crossProject ? "medium" : "low",
        "تقرير إنجاز مكرر بين موظفين",
        crossProject ? "مشاريع مختلفة" : "نفس المشروع",
      ),
    );
  });
  groupBy(
    rows.filter((r) => (n(r.hours) ?? 0) > 0),
    (r) => norm$1(r.employee_no),
  ).forEach((list) => {
    if (list.length >= 3 && new Set(list.map((r) => n(r.hours))).size === 1)
      list.forEach((r) =>
        push(
          rows.indexOf(r),
          "low",
          "ساعات إضافي ثابتة بنمط متكرر",
          `${n(r.hours)} ساعة في ${list.length} سجلات`,
        ),
      );
  });
}
function wagers(rows, push, by) {
  const payrollRows = by("HR_Payroll_Sheets");
  const wageFences = /* @__PURE__ */ new Map();
  groupBy(
    rows.filter((r) => (n(r.daily_wage) ?? 0) > 0),
    (r) => norm$1(r.project) || "-",
  ).forEach((list, k) =>
    wageFences.set(k, fences(list.map((r) => n(r.daily_wage)))),
  );
  rows.forEach((r, i) => {
    const dd = n(r.days),
      w = n(r.daily_wage),
      t = n(r.total);
    if (dd !== void 0 && w !== void 0 && t !== void 0 && !near(dd * w, t))
      push(
        i,
        "high",
        "إجمالي المستحق لا يطابق الأيام × الأجر",
        `${dd * w} مقابل ${t}`,
      );
    if (dd !== void 0 && dd > 31)
      push(i, "high", "أيام عمل تتجاوز أيام الشهر", String(dd));
    if (empty(r.id_no)) push(i, "medium", "حقل جوهري ناقص", "لم يُدخل: الرقم التعريفي");
    if (empty(r.completion_report))
      push(i, "high", "صرف أجور بدون تقرير إنجاز", "");
    else if (
      placeholder(r.completion_report) ||
      norm$1(r.completion_report).length < 8
    )
      push(i, "medium", "تقرير إنجاز شكلي أو غير مفصل", r.completion_report);
    if (w !== void 0 && w > 0) {
      if (outlier(w, wageFences.get(norm$1(r.project) || "-")))
        push(i, "medium", "أجر يومي أعلى من نظرائه في نفس المشروع", String(w));
    }
    if (
      payrollRows.length &&
      (!empty(r.id_no) || !empty(r.name)) &&
      payrollRows.some(
        (x) =>
          (!empty(r.id_no) &&
            (norm$1(x.employee_no) === norm$1(r.id_no) ||
              norm$1(x.national_id) === norm$1(r.id_no))) ||
          (!empty(r.name) && norm$1(x.name) === norm$1(r.name)),
      )
    )
      push(
        i,
        "high",
        "عامل مياومة مسجل أيضاً على كشف الرواتب",
        r.name ?? r.id_no,
      );
  });
  groupBy(rows, (r) =>
    empty(r.id_no) ? "" : `${norm$1(r.id_no)}|${norm$1(r.period)}`,
  ).forEach((list) => {
    if (list.length < 2) return;
    const projects = groupBy(list, (r) => norm$1(r.project) || "-");
    const total = list.reduce((a, r) => a + (n(r.days) ?? 0), 0);
    projects.forEach((same) =>
      same
        .slice(1)
        .forEach((r) =>
          push(
            rows.indexOf(r),
            "high",
            "ازدواج صرف: نفس العامل والمشروع والفترة",
            `${same.length} سجلات`,
          ),
        ),
    );
    if (projects.size >= 2)
      list.forEach((r) =>
        push(
          rows.indexOf(r),
          total > 31 ? "high" : "medium",
          total > 31
            ? "مجموع أيام العامل عبر المشاريع يتجاوز أيام الشهر"
            : "صرف لنفس العامل في أكثر من مشروع بنفس الفترة",
          `${projects.size} مشاريع بمجموع ${total} يوم`,
        ),
      );
  });
}
function promotions(rows, push, by) {
  const payrollRows = by("HR_Payroll_Sheets");
  const inc = fences(
    rows.flatMap((r) =>
      n(r.increment_amount) !== void 0 ? [n(r.increment_amount)] : [],
    ),
  );
  rows.forEach((r, i) => {
    if (empty(r.decision_no)) push(i, "high", "ترقية بدون رقم قرار", "");
    if (r.old_grade?.trim() && r.old_grade.trim() === r.new_grade?.trim())
      push(i, "medium", "الدرجة الجديدة مساوية للسابقة", "");
    if (
      payrollRows.length &&
      !empty(r.employee_no) &&
      !payrollRows.some((x) => norm$1(x.employee_no) === norm$1(r.employee_no))
    )
      push(i, "high", "ترقية لموظف غير موجود في كشف الرواتب", r.employee_no);
    const a = n(r.increment_amount);
    if (a !== void 0) {
      const s = outlier(a, inc);
      if (s) push(i, s, "علاوة شاذة مقارنة بنظيراتها", String(a));
    }
  });
  groupBy(
    rows.filter((r) => !empty(r.employee_no) && !empty(r.due_date)),
    (r) => `${norm$1(r.employee_no)}|${r.due_date}`,
  ).forEach((list) => {
    list
      .slice(1)
      .forEach((r) =>
        push(
          rows.indexOf(r),
          "high",
          "ترقية أو علاوة مكررة لنفس الموظف بنفس التاريخ",
          r.employee_no,
        ),
      );
  });
  groupBy(
    rows.filter((r) => !empty(r.employee_no) && d(r.due_date) !== void 0),
    (r) => norm$1(r.employee_no),
  ).forEach((list) => {
    const sorted = [...list].sort((a, b) => d(a.due_date) - d(b.due_date));
    sorted.slice(1).forEach((r, k) => {
      if (
        d(r.due_date) !== d(sorted[k].due_date) &&
        days(d(r.due_date), d(sorted[k].due_date)) <= 365
      )
        push(
          rows.indexOf(r),
          "medium",
          "ترقيات متقاربة لنفس الموظف خلال سنة",
          `${sorted[k].due_date} ثم ${r.due_date}`,
        );
    });
  });
}
function retirees(rows, push, today, by) {
  const payrollRows = by("HR_Payroll_Sheets");
  duplicates(rows, "retiree_no", push, "رقم المتقاعد");
  const gf = fences(
    rows.flatMap((r) => (n(r.gratuity) !== void 0 ? [n(r.gratuity)] : [])),
  );
  rows.forEach((r, i) => {
    const g = n(r.gratuity) ?? 0,
      rd = d(r.retire_date);
    if (empty(r.clearance_no) && g > 0)
      push(i, "high", "صرف مستحقات دون براءة ذمة", "");
    if (rd !== void 0 && rd > today && g > 0)
      push(
        i,
        "high",
        "صرف مكافأة نهاية خدمة قبل تاريخ الإحالة للتقاعد",
        r.retire_date,
      );
    if (
      payrollRows.some(
        (x) =>
          !empty(x.employee_no) &&
          norm$1(x.employee_no) === norm$1(r.retiree_no),
      )
    )
      push(i, "high", "متقاعد ما زال على كشف الرواتب", r.retiree_no);
    const s = outlier(g, gf);
    if (s) push(i, s, "مكافأة نهاية خدمة شاذة مقارنة بنظيراتها", String(g));
  });
}
function leaves(rows, push, by) {
  const payrollRows = by("HR_Payroll_Sheets");
  rows.forEach((r, i) => {
    const s = d(r.start),
      e = d(r.end),
      b = n(r.balance);
    if (s !== void 0 && e !== void 0 && e < s)
      push(i, "high", "تاريخ النهاية قبل البداية", "");
    if (b !== void 0 && b < 0) push(i, "high", "رصيد إجازات سالب", String(b));
    if (
      payrollRows.length &&
      !empty(r.employee_no) &&
      !payrollRows.some((x) => norm$1(x.employee_no) === norm$1(r.employee_no))
    )
      push(i, "high", "إجازة لموظف غير موجود في كشف الرواتب", r.employee_no);
  });
  const byEmp = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const s = d(r.start),
      e = d(r.end);
    if (!r.employee_no?.trim() || s === void 0 || e === void 0) return;
    const list = byEmp.get(r.employee_no) ?? [];
    list.forEach(([a, b, j]) => {
      if (s <= b && e >= a)
        push(i, "medium", "تداخل إجازات للموظف", `مع السجل ${j + 1}`);
    });
    list.push([s, e, i]);
    byEmp.set(r.employee_no, list);
  });
}
var plateKey = (v) => norm$1(v).replace(/[\s-]/g, "");
var dayOf = (v) => {
  const t = d(v);
  return t === void 0 ? void 0 : Math.floor(t / DAY);
};
function fuelStation(rows, push, p, by) {
  const sys = by("Fleet_Fuel_System_Logs"),
    orders = by("Fleet_Movement_Orders"),
    gps = by("Fleet_GPS_Tracking_Logs");
  duplicates(rows, "invoice_no", push, "رقم فاتورة المحطة");
  const sysTotals = /* @__PURE__ */ new Map();
  sys.forEach((r) => {
    const k = plateKey(r.vehicle),
      l = n(r.liters);
    if (k && l !== void 0) sysTotals.set(k, (sysTotals.get(k) ?? 0) + l);
  });
  const stTotals = /* @__PURE__ */ new Map(),
    firstRow = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const v = plateKey(r.vehicle),
      l = n(r.liters);
    if (v && l !== void 0) {
      stTotals.set(v, (stTotals.get(v) ?? 0) + l);
      if (!firstRow.has(v)) firstRow.set(v, i);
    }
    const price = n(r.unit_price),
      contract =
        n(r.contract_price) ??
        (p.contractFuelPrice > 0 ? p.contractFuelPrice : void 0),
      amount = n(r.amount);
    if (price !== void 0 && contract !== void 0 && Math.abs(price - contract) > 5e-4)
      push(
        i,
        price > contract ? "high" : "medium",
        "سعر اللتر في فاتورة المحطة يخالف سعر العقد",
        `الفاتورة ${price} مقابل العقد ${contract}`,
      );
    if (
      l !== void 0 &&
      price !== void 0 &&
      amount !== void 0 &&
      Math.abs(amount - l * price) > Math.max(0.05, Math.abs(amount) * 5e-3)
    )
      push(
        i,
        "high",
        "قيمة الفاتورة لا تطابق الكمية × السعر",
        `المسجل ${amount} والمحسوب ${Math.round(l * price * 100) / 100}`,
      );
    const t = d(r.datetime);
    if (t !== void 0) {
      const dt = new Date(t),
        hasTime = /\d:\d/.test(String(r.datetime ?? "")),
        weekend = dt.getDay() === 5 || dt.getDay() === 6,
        hr = dt.getHours();
      if (weekend || (hasTime && (hr < p.workStartHour || hr >= p.workEndHour)))
        push(
          i,
          "medium",
          "صرف محروقات خارج الدوام الرسمي",
          String(r.datetime),
        );
    }
    if (v && orders.length) {
      const own = orders.filter((o) => plateKey(o.vehicle) === v);
      if (!own.length)
        push(
          i,
          "high",
          "تعبئة في المحطة بلا أمر حركة (تعبئة وهمية محتملة)",
          r.vehicle ?? "",
        );
      else {
        const day = dayOf(r.datetime);
        if (day !== void 0 && !own.some((o) => dayOf(o.date) === day))
          push(
            i,
            "medium",
            "تعبئة في تاريخ لا يوجد فيه أمر حركة للآلية",
            `${r.vehicle} — ${r.datetime}`,
          );
      }
    }
    if (v && gps.length) {
      const own = gps.filter((g) => plateKey(g.vehicle) === v);
      if (!own.length)
        push(i, "medium", "تعبئة بلا أثر في نظام التتبع (GPS)", r.vehicle ?? "");
      else {
        const day = dayOf(r.datetime);
        if (
          day !== void 0 &&
          own.some((g) => dayOf(g.datetime) === day && yes(g.off_hours))
        )
          push(
            i,
            "high",
            "تعبئة مقترنة بتشغيل خارج الدوام في GPS",
            `${r.vehicle} — ${r.datetime}`,
          );
      }
    }
    if (v && sys.length && !sysTotals.has(v))
      push(
        i,
        "high",
        "كمية في المحطة بلا قيد في نظام المحروقات",
        r.vehicle ?? "",
      );
  });
  stTotals.forEach((st, v) => {
    const sy = sysTotals.get(v);
    if (sy === void 0) return;
    const diff = st - sy,
      pct = sy > 0 ? (Math.abs(diff) / sy) * 100 : 100;
    if (pct > p.fuelTolerancePct)
      push(
        firstRow.get(v),
        pct > p.fuelTolerancePct * 5 ? "high" : "medium",
        "فرق كمية بين نظام المحروقات وكشف المحطة",
        `النظام ${sy} لتر مقابل المحطة ${st} لتر (فرق ${Math.round(diff * 100) / 100} لتر، ${Math.round(pct * 10) / 10}%)`,
      );
  });
}
function maintenance(rows, push, p, today, by) {
  duplicates(rows, "invoice_no", push, "رقم الفاتورة");
  const costs = rows
    .map((r) => n(r.parts_cost))
    .filter((x) => x !== void 0);
  const f = fences(costs);
  rows.forEach((r, i) => {
    const c = n(r.parts_cost);
    if (c !== void 0 && f) {
      const sv = outlier(c, f);
      if (sv)
        push(i, sv, "تكلفة قطع غيار مرتفعة بشكل شاذ", `${c} (الحد المعتاد ${Math.round(f.mid)})`);
    }
  });
  const lic = by("Fleet_Licensing_Insurance"),
    fuel = by("Fleet_Fuel_System_Logs"),
    year = new Date(today).getFullYear();
  const totals = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const v = plateKey(r.vehicle),
      c = n(r.parts_cost);
    if (!v || c === void 0) return;
    const t = totals.get(v) ?? { sum: 0, top: i, topCost: -1 };
    t.sum += c;
    if (c > t.topCost) {
      t.topCost = c;
      t.top = i;
    }
    totals.set(v, t);
  });
  if (totals.size >= 3) {
    const sorted = [...totals.values()].map((t) => t.sum).sort((a, b) => a - b),
      mid = quart(sorted, 0.5);
    totals.forEach((t, v) => {
      if (!(mid > 0) || t.sum <= mid * p.maintenanceMultiple) return;
      const l = lic.find((x) => plateKey(x.plate) === v);
      const y = /(?:19|20)\d{2}/.exec(String(l?.model ?? ""));
      const age = y ? year - Number(y[0]) : void 0;
      const odos = fuel
        .filter((x) => plateKey(x.vehicle) === v)
        .map((x) => n(x.odometer))
        .filter((x) => x !== void 0);
      const km = odos.length > 1 ? Math.max(...odos) - Math.min(...odos) : 0;
      const extra = [
        age !== void 0 ? `عمر الآلية ${age} سنة` : "",
        km > 0 ? `المسافة المقطوعة ${km} كم (${Math.round((t.sum / km) * 1000)} لكل 1000 كم)` : "",
      ].filter(Boolean);
      push(
        t.top,
        age !== void 0 && age <= 3 ? "high" : "medium",
        "تضخم تكلفة صيانة الآلية مقارنة بوسيط الأسطول",
        `إجمالي ${Math.round(t.sum)} مقابل وسيط ${Math.round(mid)}${extra.length ? " — " + extra.join("، ") : ""}`,
      );
    });
  }
  groupBy(
    rows.flatMap((r, i) => {
      const v = plateKey(r.vehicle),
        ds = norm$1(r.description),
        t = d(r.date);
      return v && ds && t !== void 0 ? [{ i, key: `${v}|${ds}`, t }] : [];
    }),
    (x) => x.key,
  ).forEach((list) => {
    const s = [...list].sort((a, b) => a.t - b.t);
    s.forEach((cur, k) => {
      const prev = s[k - 1];
      if (prev && cur.t - prev.t <= 30 * DAY)
        push(
          cur.i,
          "medium",
          "تكرار إصلاح نفس العطل خلال 30 يوماً",
          `بعد ${days(cur.t, prev.t)} يوم من الإصلاح السابق`,
        );
    });
  });
}
function runAudit(store, today = Date.now(), params = {}) {
  const p = {
    ...defaultParams,
    ...params,
  };
  const out = [];
  const by = (key) => store[key] ?? [];
  for (const ds of allDatasets) {
    const rows = by(ds.key);
    const push = (row, severity, test, detail) =>
      out.push({
        dataset: ds.key,
        sector: ds.sector,
        row,
        severity,
        test,
        detail,
      });
    rows.forEach((r, i) =>
      ds.fields.forEach((fl) => {
        const v = val(r, fl.key);
        if (fl.type === "date" && !empty(v) && d(v) === void 0)
          push(i, "low", "تاريخ غير صالح", fl.label);
        if (fl.type === "number" && !empty(v) && n(v) === void 0)
          push(i, "low", "قيمة رقمية غير صالحة", fl.label);
      }),
    );
    switch (ds.key) {
      case "Receipt_Vouchers":
        receipts(rows, push, p, today, by);
        break;
      case "Payment_Vouchers":
        payments(rows, push);
        break;
      case "Revenue_Profession_Licenses":
        duplicates(rows, "license_no", push, "رقم الرخصة");
        rows.forEach((r, i) => {
          const due = n(r.fee_due), paid = n(r.fee_paid), bank = n(r.bank_deposit);
          if (due !== void 0 && (paid ?? 0) < due)
            push(i, "high", "رسوم رخصة مستحقة غير محصلة", `${due - (paid ?? 0)}`);
          if (paid !== void 0 && bank !== void 0 && bank < paid)
            push(i, "high", "المحصل لا يطابق الواصل للحساب البنكي", `${paid} / ${bank}`);
        });
        break;
      case "Revenue_Property_Taxes_Regulation":
        rows.forEach((r, i) => {
          const due = n(r.amount_due), paid = n(r.amount_paid), bank = n(r.bank_deposit);
          if (due !== void 0 && (paid ?? 0) < due)
            push(i, "high", "عوائد مستحقة غير محصلة", `${due - (paid ?? 0)}`);
          if (paid !== void 0 && bank !== void 0 && bank < paid)
            push(i, "high", "المحصل لا يطابق الواصل للحساب البنكي", `${paid} / ${bank}`);
        });
        break;
      case "Revenue_Municipal_Properties_Leases":
        rows.forEach((r, i) => {
          const due = d(r.due_date), pd = d(r.paid_date), inst = n(r.installment), paid = n(r.paid_amount);
          if (due !== void 0 && pd === void 0 && due < today)
            push(i, "high", "قسط إيجار متأخر دون سداد", `${Math.floor((today - due) / 864e5)} يوم`);
          else if (due !== void 0 && pd !== void 0 && pd > due)
            push(i, "medium", "تأخر المستأجر في سداد القسط", `${Math.floor((pd - due) / 864e5)} يوم`);
          if (inst !== void 0 && paid !== void 0 && paid < inst)
            push(i, "medium", "المسدد أقل من قيمة القسط", `${paid} < ${inst}`);
          const end = d(r.end_date);
          if (end !== void 0 && end < today && empty(r.paid_date))
            push(i, "medium", "عقد منتهٍ بذمة غير مسددة", r.contract_no ?? "");
        });
        break;
      case "Revenue_Daily_Fees":
        rows.forEach((r, i) => {
          const due = n(r.amount_due), col = n(r.amount_collected), dep = n(r.deposited_amount);
          if (due !== void 0 && col !== void 0 && col < due)
            push(i, "high", "المحصل أقل من المستحق", `${col} < ${due}`);
          if (col !== void 0 && dep !== void 0 && dep < col)
            push(i, "high", "المورد أقل من المحصل", `${col - dep}`);
        });
        break;
      case "Trial_Balance": {
        let dr = 0,
          cr = 0;
        rows.forEach((r, i) => {
          const o = n(r.opening),
            a = n(r.debit),
            b = n(r.credit),
            c = n(r.closing);
          dr += a ?? 0;
          cr += b ?? 0;
          if (o !== void 0 && a !== void 0 && b !== void 0 && c !== void 0) {
            const exp = /دائن|credit/i.test(String(r.nature ?? ""))
              ? o + b - a
              : o + a - b;
            if (!near(Math.abs(exp), Math.abs(c)))
              push(
                i,
                "high",
                "الرصيد الختامي لا يطابق الحركات",
                `المتوقع ${exp} والمسجل ${c}`,
              );
          }
        });
        if (rows.length && !near(dr, cr))
          push(
            0,
            "high",
            "ميزان المراجعة غير متوازن",
            `مجموع المدين ${dr} ≠ مجموع الدائن ${cr}`,
          );
        break;
      }
      case "Adjustments":
        required(
          rows,
          [
            ["reason", "سبب التسوية"],
            ["requester", "الجهة الطالبة"],
          ],
          push,
        );
        duplicates(rows, "entry_no", push, "رقم قيد التسوية");
        break;
      case "Bank_Reconciliations":
        bankReconciliations(rows, push, p, today, by);
        break;
      case "Petty_Cash":
        pettyCash(rows, push, p, today);
        break;
      case "Clearing_Accounts":
        rows.forEach((r, i) => {
          const tc = d(r.target_close);
          if (tc !== void 0 && tc < today)
            push(
              i,
              "high",
              "حساب وسيط تجاوز تاريخ الإغلاق",
              `متأخر ${days(today, tc)} يوم`,
            );
          if (empty(r.reason)) push(i, "medium", "سبب التعليق غير موثق", "");
        });
        break;
      case "HR_Establishment_Table":
        duplicates(rows, "position_no", push, "رقم الوظيفة");
        required(
          rows,
          [
            ["title", "المسمى الوظيفي المعتمد"],
            ["grade", "الدرجة المقررة"],
            ["annual_allocation", "المخصص المالي السنوي"],
          ],
          push,
        );
        break;
      case "HR_Payroll_Sheets":
        payroll(rows, push, p, today, by);
        break;
      case "HR_Overtime_Bonuses":
        overtime(rows, push, p, by);
        break;
      case "HR_Leaves_Records":
        leaves(rows, push, by);
        break;
      case "HR_Daily_Wagers":
        wagers(rows, push, by);
        break;
      case "HR_Promotions_Increments":
        promotions(rows, push, by);
        break;
      case "HR_Retirees_Settlements":
        retirees(rows, push, today, by);
        break;
      case "Fleet_Movement_Orders":
        duplicates(rows, "order_no", push, "رقم أمر الحركة");
        required(
          rows,
          [
            ["purpose", "الغرض الرسمي"],
            ["driver", "اسم السائق"],
          ],
          push,
        );
        break;
      case "Fleet_GPS_Tracking_Logs":
        rows.forEach((r, i) => {
          if (yes(r.off_hours))
            push(i, "high", "تشغيل خارج الدوام / العطل", r.datetime ?? "");
          if (yes(r.geofence))
            push(i, "high", "تجاوز النطاق الجغرافي", r.actual_route ?? "");
        });
        break;
      case "Fleet_Fuel_System_Logs": {
        const orders = by("Fleet_Movement_Orders");
        const last = /* @__PURE__ */ new Map();
        rows.forEach((r, i) => {
          if (no(r.order_match))
            push(i, "high", "تعبئة محروقات لا تطابق أمر حركة", r.vehicle ?? "");
          if (
            orders.length &&
            r.vehicle?.trim() &&
            !orders.some((o) => o.vehicle?.trim() === r.vehicle.trim())
          )
            push(i, "medium", "آلية بدون أي أمر حركة", r.vehicle);
          const od = n(r.odometer),
            v = r.vehicle?.trim();
          if (v && od !== void 0) {
            const prev = last.get(v);
            if (prev !== void 0 && od <= prev)
              push(i, "high", "قراءة عداد غير متسلسلة", `${od} ≤ ${prev}`);
            last.set(v, od);
          }
        });
        const groups = /* @__PURE__ */ new Map();
        rows.forEach((r, i) => {
          const v = r.vehicle?.trim(),
            rt = n(r.rate);
          if (v && rt !== void 0)
            groups.set(v, [...(groups.get(v) ?? []), [rt, i]]);
        });
        const stRows = by("Fleet_Station_Fuel_Statements");
        if (stRows.length) {
          const confirmed = new Set(stRows.map((x) => plateKey(x.vehicle)));
          rows.forEach((r, i) => {
            const v = plateKey(r.vehicle);
            if (v && !confirmed.has(v))
              push(
                i,
                "medium",
                "صرف في النظام الداخلي غير مؤكد بكشف المحطة",
                r.vehicle ?? "",
              );
          });
        }
        groups.forEach((list) => {
          const f = fences(list.map((x) => x[0]));
          if (f)
            list.forEach(([rt, i]) => {
              if (rt > f.mid)
                push(
                  i,
                  "medium",
                  "معدل استهلاك شاذ مقارنة بسجلات الآلية",
                  String(rt),
                );
            });
        });
        break;
      }
      case "Fleet_Station_Fuel_Statements":
        fuelStation(rows, push, p, by);
        break;
      case "Fleet_Maintenance":
        maintenance(rows, push, p, today, by);
        required(
          rows,
          [
            ["invoice_no", "رقم الفاتورة"],
            ["workshop", "ورشة الإصلاح"],
          ],
          push,
        );
        break;
      case "Fleet_Licensing_Insurance":
        rows.forEach((r, i) => {
          const pe = d(r.prev_expiry);
          if (pe !== void 0 && pe < today && empty(r.new_license))
            push(
              i,
              "high",
              "آلية برخصة منتهية دون تجديد",
              `انتهت منذ ${days(today, pe)} يوم`,
            );
          if (/منته|غير|لا يوجد|expired|none/i.test(r.insurance_status ?? ""))
            push(i, "high", "تأمين غير ساري", r.insurance_status);
          const warn = p.licenseWarnDays * DAY;
          if (
            pe !== void 0 &&
            pe >= today &&
            pe - today <= warn &&
            empty(r.new_license)
          )
            push(
              i,
              "medium",
              "رخصة آلية تقترب من الانتهاء",
              `تنتهي بعد ${days(pe, today)} يوم`,
            );
          const ie = d(r.insurance_expiry);
          if (ie !== void 0 && ie < today)
            push(
              i,
              "high",
              "بوليصة تأمين منتهية",
              `انتهت منذ ${days(today, ie)} يوم`,
            );
          else if (ie !== void 0 && ie - today <= warn)
            push(
              i,
              "medium",
              "بوليصة تأمين تقترب من الانتهاء",
              `تنتهي بعد ${days(ie, today)} يوم`,
            );
        });
        break;
      case "Warehouse_Master_List":
        duplicates(rows, "item_no", push, "رقم الصنف");
        break;
      case "Warehouses_Inbound_Vouchers": {
        duplicates(rows, "voucher_no", push, "رقم سند الإدخال");
        required(rows, [["po_no", "رقم أمر الشراء"]], push);
        const pos = by("Direct_Purchases_Orders"),
          master = by("Warehouse_Master_List");
        if (pos.length)
          rows.forEach((r, i) => {
            if (
              r.po_no?.trim() &&
              !pos.some((x) => x.po_no?.trim() === r.po_no.trim())
            )
              push(i, "high", "أمر شراء غير مسجل", r.po_no);
          });
        if (master.length)
          rows.forEach((r, i) => {
            if (
              r.item_no?.trim() &&
              !master.some((m) => m.item_no?.trim() === r.item_no.trim())
            )
              push(i, "medium", "صنف غير معرف في الكشف الشامل", r.item_no);
          });
        break;
      }
      case "Warehouses_Outbound_Vouchers":
        duplicates(rows, "voucher_no", push, "رقم سند الإخراج");
        required(
          rows,
          [
            ["receiver", "اسم المستلم"],
            ["purpose", "الغرض"],
          ],
          push,
        );
        break;
      case "Warehouses_Physical_Stocktaking":
        rows.forEach((r, i) => {
          const b = n(r.book),
            ph = n(r.physical);
          if (b !== void 0 && ph !== void 0 && !near(b, ph)) {
            push(
              i,
              ph < b ? "high" : "medium",
              ph < b ? "عجز في الجرد" : "زيادة في الجرد",
              `دفتري ${b} / فعلي ${ph}`,
            );
            if (empty(r.reasons)) push(i, "medium", "فروقات جرد بلا تبرير", "");
          }
        });
        break;
      case "Warehouses_Obsolete":
        rows.forEach((r, i) => {
          if (empty(r.writeoff))
            push(i, "medium", "مواد راكدة/تالفة دون قرار شطب", r.name ?? "");
        });
        break;
      case "Advances_Temporary": {
        const st = by("Advances_Settlements");
        const settledOf = (no) =>
          st.some(
            (s) =>
              s.advance_no?.trim() === no?.trim() && (n(s.remaining) ?? 0) <= 0,
          );
        duplicates(rows, "advance_no", push, "رقم السلفة");
        rows.forEach((r, i) => {
          const due = d(r.due_date);
          if (due !== void 0 && due < today && !settledOf(r.advance_no))
            push(
              i,
              "high",
              "سلفة مؤقتة متجاوزة لتاريخ الاستحقاق دون تسوية",
              `${days(today, due)} يوم`,
            );
          const emp = r.employee?.trim();
          if (
            emp &&
            rows.some(
              (o, j) =>
                j < i && o.employee?.trim() === emp && !settledOf(o.advance_no),
            )
          )
            push(i, "high", "سلفة جديدة قبل تسوية سلفة سابقة", emp);
        });
        break;
      }
      case "Advances_Settlements": {
        const adv = by("Advances_Temporary");
        rows.forEach((r, i) => {
          const a = adv.find(
            (x) => x.advance_no?.trim() === r.advance_no?.trim(),
          );
          const inv = n(r.invoices) ?? 0,
            ref = n(r.refund) ?? 0,
            rem = n(r.remaining);
          if (a) {
            const amt = n(a.amount);
            if (amt !== void 0 && rem !== void 0 && !near(amt - inv - ref, rem))
              push(
                i,
                "high",
                "رصيد السلفة المتبقي غير صحيح",
                `المتوقع ${amt - inv - ref}`,
              );
          } else if (adv.length)
            push(i, "medium", "تسوية لسلفة غير مسجلة", r.advance_no ?? "");
          if (ref > 0 && empty(r.receipt_no))
            push(i, "high", "فائض مرتجع بدون سند قبض", "");
          if (rem !== void 0 && rem > 0)
            push(i, "medium", "سلفة غير مسواة بالكامل", String(rem));
        });
        break;
      }
      case "Advances_Permanent_Petty":
        rows.forEach((r, i) => {
          const ap = n(r.approved),
            sp = n(r.spent),
            c = n(r.cash);
          if (
            ap !== void 0 &&
            sp !== void 0 &&
            c !== void 0 &&
            !near(ap - sp, c)
          )
            push(
              i,
              "high",
              "رصيد النقدية لا يطابق المعتمد − المصروف",
              `المتوقع ${ap - sp}`,
            );
          if (ap !== void 0 && sp !== void 0 && sp > ap)
            push(i, "high", "المصروف يتجاوز القيمة المعتمدة", "");
        });
        break;
      case "Advances_Overdue_Outstanding":
        rows.forEach((r, i) => {
          const dy = n(r.days) ?? 0;
          if (dy > 0 && empty(r.actions))
            push(i, "high", "ذمة متأخرة دون إجراء متخذ", `${dy} يوم`);
          else if (dy > 0)
            push(i, "medium", "ذمة متأخرة قيد المتابعة", `${dy} يوم`);
        });
        break;
      case "Engineering_BoQ_Master":
        rows.forEach((r, i) => {
          const q = n(r.quantity), up = n(r.unit_price), t = n(r.total);
          if (q !== void 0 && up !== void 0 && t !== void 0 && Math.abs(q * up - t) > 0.01)
            push(i, "medium", "إجمالي البند لا يساوي الكمية × السعر", `${q * up} / ${t}`);
        });
        break;
      case "Engineering_Site_Handover_Minutes":
        duplicates(rows, "minutes_no", push, "رقم المحضر");
        rows.forEach((r, i) => {
          const h = d(r.handover_date), c = d(r.commencement_date);
          if (h !== void 0 && c !== void 0 && c < h)
            push(i, "medium", "المباشرة العقدية تسبق تسليم الموقع", "");
          if (empty(r.signed_by)) push(i, "medium", "محضر تسليم دون توقيعات", r.minutes_no ?? "");
        });
        break;
      case "Engineering_Progress_Payments": {
        const boq = by("Engineering_BoQ_Master"),
          hand = by("Engineering_Site_Handover_Minutes"),
          ext = by("Engineering_Time_Extensions_Variations");
        const paidBy = new Map();
        rows.forEach((r) => {
          const k = String(r.project_no ?? "").trim();
          paidBy.set(k, (paidBy.get(k) ?? 0) + (n(r.paid_amount) ?? 0));
        });
        rows.forEach((r, i) => {
          const k = String(r.project_no ?? "").trim();
          const cv = n(boq.find((b) => String(b.project_no ?? "").trim() === k && n(b.contract_value))?.contract_value);
          if (cv && (paidBy.get(k) ?? 0) > cv)
            push(i, "high", "المصروف يتجاوز السقف المالي للعقد", `${paidBy.get(k)} > ${cv}`);
          const it = boq.find((b) => String(b.project_no ?? "").trim() === k && b.item_no && b.item_no === r.item_no);
          const bq = n(it?.quantity), eq = n(r.executed_qty);
          if (it && bq !== void 0 && eq !== void 0 && eq > bq)
            push(i, "high", "الكمية المنفذة تتجاوز كمية جدول الكميات", `${eq} > ${bq}`);
          if (!it && !empty(r.item_no) && boq.length)
            push(i, "medium", "بند مصروف غير وارد في جدول الكميات", r.item_no);
          const h = hand.find((x) => String(x.project_no ?? "").trim() === k);
          const st = d(h?.commencement_date), days = n(h?.contract_days), pd = d(r.date), pc = n(r.progress_pct);
          if (st !== void 0 && days && pd !== void 0 && pc !== void 0) {
            const extDays = ext
              .filter((x) => String(x.project_no ?? "").trim() === k && String(x.approved ?? "").trim() === "نعم")
              .reduce((a, x) => a + (n(x.extension_days) ?? 0), 0);
            const elapsed = (pd - st) / 864e5, total = days + extDays;
            if (elapsed > total && pc < 100 && !(n(r.delay_penalty) > 0))
              push(i, "high", "تجاوز المدة العقدية دون غرامة تأخير", `${Math.floor(elapsed)} / ${total} يوم`);
            else if (elapsed / total - pc / 100 > 0.2)
              push(i, "medium", "الإنجاز الفعلي متأخر عن المدة المنقضية", `${pc}% / ${Math.round((elapsed / total) * 100)}%`);
          }
        });
        break;
      }
      case "Engineering_Time_Extensions_Variations":
        duplicates(rows, "request_no", push, "رقم الطلب");
        rows.forEach((r, i) => {
          const ok = String(r.approved ?? "").trim() === "نعم";
          if (!ok && !empty(r.approved)) push(i, "low", "طلب غير معتمد", r.request_no ?? "");
          if (empty(r.approved_by) && ok) push(i, "high", "اعتماد دون جهة معتمدة", r.request_no ?? "");
          if ((n(r.variation_value) ?? 0) > 0 && !ok) push(i, "high", "أمر تغيير مالي غير معتمد", `${n(r.variation_value)}`);
        });
        break;
      case "Tenders_Records":
        duplicates(rows, "tender_no", push, "رقم العطاء");
        required(
          rows,
          [
            ["committee", "لجنة العطاءات"],
            ["winner", "الجهة المحال عليها"],
          ],
          push,
        );
        rows.forEach((r, i) => {
          const est = n(r.estimated_value),
            aw = n(r.awarded_value),
            b = n(r.bidders);
          if (est && aw !== void 0 && aw > est)
            push(i, "high", "قيمة الإحالة تتجاوز القيمة التقديرية", `${aw} > ${est}`);
          if (b !== void 0 && b < 2)
            push(i, "medium", "عطاء بمتقدم وحيد", r.tender_no ?? "");
        });
        break;
      case "Direct_Purchases_Orders":
        duplicates(rows, "po_no", push, "رقم أمر الشراء");
        required(
          rows,
          [
            ["approver", "صاحب الصلاحية الموافق"],
            ["method", "طريقة الشراء"],
          ],
          push,
        );
        groupBy(
          rows.flatMap((r, i) =>
            r.supplier?.trim() && r.date
              ? [
                  {
                    r,
                    i,
                  },
                ]
              : [],
          ),
          ({ r }) => `${r.supplier.trim()}|${r.date}`,
        ).forEach((list) => {
          if (list.length > 1)
            list.forEach(({ i }) =>
              push(
                i,
                "high",
                "احتمال تجزئة مشتريات",
                `${list.length} أوامر لنفس المورد بنفس اليوم`,
              ),
            );
        });
    }
  }
  const sectorOf = (k) => allDatasets.find((x) => x.key === k)?.sector;
  out.push(
    ...sodFindings(store, sectorOf),
    ...fraudFindings(store, sectorOf),
    ...advancedFindings(store, sectorOf, p, today),
  );
  return out;
}
var riskLevel = (fs) =>
  fs.some((f) => f.severity === "high")
    ? "high"
    : fs.some((f) => f.severity === "medium")
      ? "medium"
      : fs.length
        ? "low"
        : "none";
var REPORTS = "rasd-audit-reports";
function loadReports() {
  try {
    const v = JSON.parse(localStorage.getItem(REPORTS) ?? "[]");
    return mergeSeedReports(Array.isArray(v) ? v : []);
  } catch {
    return mergeSeedReports([]);
  }
}
function storeReports(r) {
  try {
    localStorage.setItem(REPORTS, JSON.stringify(r));
  } catch {
    /* storage full: the user is warned by the backup panel */
  }
}
/** بيانات العرض التجريبي كاملة: المخزن والمعايرة وملاحظات اليوم والتقرير السابق (يُستعمل من زر العرض ورابط ?demo=1). */
function buildDemoBundle(now = Date.now()) {
  const store = buildDemoStore(now);
  const params = { ...defaultParams, ...DEMO_PARAMS };
  const base = runAudit(store, now, params).map((f) => {
    const d = allDatasets.find((x) => x.key === f.dataset);
    const row = store[f.dataset]?.[f.row] ?? {};
    const ref = d ? (row[d.fields[0].key] ?? "") : "";
    return { ...f, ref, key: `${f.dataset}|${f.test.trim()}|${String(ref).trim()}` };
  });
  return { store, params, base, report: buildDemoPreviousReport(base, now) };
}
/**
 * رابط العرض المباشر ?demo=1: إن كانت المنصة فارغة يكتب بيانات العرض في التخزين قبل فتح لوحة التدقيق، ثم ينظف الرابط.
 * لا يستبدل بيانات أي مستخدم أبدًا. يعيد true عند التحميل.
 */
function seedDemoFromUrl() {
  try {
    const url = new URL(location.href);
    if (url.searchParams.get("demo") !== "1") return false;
    url.searchParams.delete("demo");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    const stored = JSON.parse(localStorage.getItem("rasd-audit-store") ?? "{}") ?? {};
    const hasData = Object.values(stored).some((r) => Array.isArray(r) && r.length) || (JSON.parse(localStorage.getItem(REPORTS) ?? "[]") ?? []).length > 0;
    if (hasData) return false;
    const { store, params, report } = buildDemoBundle();
    localStorage.setItem("rasd-audit-store", JSON.stringify(store));
    localStorage.setItem("rasd-audit-params", JSON.stringify(params));
    localStorage.setItem(REPORTS, JSON.stringify([report]));
    localStorage.setItem(DEMO_FLAG_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
var findingKey = (dataset, test, ref) =>
  `${dataset}|${test.trim()}|${ref.trim()}`;
var testKey = (dataset, test) => `${dataset}|${test.trim()}`;
var stop = /* @__PURE__ */ new Set([
  "غير",
  "دون",
  "بدون",
  "على",
  "إلى",
  "الى",
  "من",
  "في",
  "مع",
  "عن",
  "أو",
  "لا",
  "ما",
  "قبل",
  "بعد",
  "بلا",
  "مقارنة",
]);
var norm = (s) =>
  s
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
var tokens = (s) =>
  norm(s)
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.replace(/^(ال|وال|بال|لل)/, ""))
    .filter((w) => w.length >= 3 && !stop.has(w));
function matchRegulation(test, docs) {
  const q = [...new Set(tokens(test))];
  if (!q.length) return;
  let best;
  for (const d of docs)
    for (const seg of d.segments) {
      const score = q.filter((w) =>
        [...seg.toks].some(
          (t) =>
            t.startsWith(w.slice(0, 4)) ||
            (w.startsWith(t.slice(0, 4)) && t.length >= 4),
        ),
      ).length;
      if (score >= Math.min(2, q.length) && (!best || score > best.score))
        best = {
          doc: d.name,
          docId: d.id,
          excerpt: seg.text.slice(0, 260),
          score,
        };
    }
  return best;
}
function segmentDoc(text) {
  // يُصلح النص أولًا (يشمل مستندات خُزّنت بحروف مشوّهة قبل هذا الإصدار) ثم تُستبعد المقاطع التي بقي فيها تلف،
  // فلا يظهر نص مشوّه في خانة «السند القانوني» أبدًا.
  return repairArabic(text)
    .split(/(?<=[.。؛:])\s+|\n+|(?=\s(?:المادة|مادة)\s)/)
    .map((t) => t.trim())
    .filter((t) => t.length > 15 && !isGarbled(t))
    .map((t) => ({
      text: t,
      toks: new Set(tokens(t)),
    }));
}
var escalate = (s) => (s === "low" ? "medium" : "high");
var Amiri_Regular_default = "/fonts/Amiri-Regular.ttf";
var F = {
  ء: [65152, 0, 0, 0],
  آ: [65153, 65154, 0, 0],
  أ: [65155, 65156, 0, 0],
  ؤ: [65157, 65158, 0, 0],
  إ: [65159, 65160, 0, 0],
  ئ: [65161, 65162, 65163, 65164],
  ا: [65165, 65166, 0, 0],
  ب: [65167, 65168, 65169, 65170],
  ة: [65171, 65172, 0, 0],
  ت: [65173, 65174, 65175, 65176],
  ث: [65177, 65178, 65179, 65180],
  ج: [65181, 65182, 65183, 65184],
  ح: [65185, 65186, 65187, 65188],
  خ: [65189, 65190, 65191, 65192],
  د: [65193, 65194, 0, 0],
  ذ: [65195, 65196, 0, 0],
  ر: [65197, 65198, 0, 0],
  ز: [65199, 65200, 0, 0],
  س: [65201, 65202, 65203, 65204],
  ش: [65205, 65206, 65207, 65208],
  ص: [65209, 65210, 65211, 65212],
  ض: [65213, 65214, 65215, 65216],
  ط: [65217, 65218, 65219, 65220],
  ظ: [65221, 65222, 65223, 65224],
  ع: [65225, 65226, 65227, 65228],
  غ: [65229, 65230, 65231, 65232],
  ف: [65233, 65234, 65235, 65236],
  ق: [65237, 65238, 65239, 65240],
  ك: [65241, 65242, 65243, 65244],
  ل: [65245, 65246, 65247, 65248],
  م: [65249, 65250, 65251, 65252],
  ن: [65253, 65254, 65255, 65256],
  ه: [65257, 65258, 65259, 65260],
  و: [65261, 65262, 0, 0],
  ى: [65263, 65264, 0, 0],
  ي: [65265, 65266, 65267, 65268],
};
var rightOnly = /* @__PURE__ */ new Set("اأإآؤءدذرزوةى");
var unshapeMap = /* @__PURE__ */ new Map();
for (const [base, forms] of Object.entries(F))
  for (const cp of forms)
    if (cp) unshapeMap.set(String.fromCodePoint(cp), base);
var isAr = (c) => F[c] !== void 0;
function toVisual(text) {
  const chars = [...text];
  return chars
    .map((c, i) => {
      const forms = F[c];
      if (!forms) return c;
      const prev = chars[i - 1],
        next = chars[i + 1];
      const joinsPrev = prev !== void 0 && isAr(prev) && !rightOnly.has(prev);
      const joinsNext = next !== void 0 && isAr(next);
      const cp =
        joinsPrev && joinsNext && forms[3]
          ? forms[3]
          : joinsPrev && forms[1]
            ? forms[1]
            : joinsNext && forms[2]
              ? forms[2]
              : forms[0];
      return String.fromCodePoint(cp);
    })
    .reverse()
    .join("");
}
function fromVisual(text) {
  return [...text]
    .reverse()
    .map((c) => unshapeMap.get(c) ?? c)
    .join("");
}
var toBase64 = (buf) => {
  let s = "";
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 32768)
    s += String.fromCharCode(...b.subarray(i, i + 32768));
  return btoa(s);
};
var sevWord = {
  high: "مرتفعة",
  medium: "متوسطة",
  low: "منخفضة",
};
async function downloadReportPdf(report, datasetLabel) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const font = await fetch(Amiri_Regular_default).then((r) => r.arrayBuffer());
  doc.addFileToVFS("Amiri-Regular.ttf", toBase64(font));
  doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
  doc.setFont("Amiri");
  const X = 200;
  let y = 20;
  const line = (text, size = 12, gap = 7) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(size);
    doc.text(toVisual(text), X, y, { align: "right" });
    y += gap;
  };
  line(report.name, 18, 12);
  line(
    report.kind === "audit"
      ? `التاريخ: ${report.date} · عدد الملاحظات الرقابية: ${report.observations.length}`
      : `التاريخ: ${report.date} · عدد الملاحظات: ${report.findings.length}`,
    11,
    12,
  );
  if (report.kind === "audit") {
    const sum = summaryText(summarize(report.observations));
    (sum.match(/.{1,70}(\s|$)/g) ?? [sum]).forEach((c) => line(c.trim(), 11, 7));
    if (report.compliance?.pct != null)
      line(`نسبة السجلات الخالية من الملاحظات: ${report.compliance.pct}%`, 11, 10);
    y += 4;
  }
  for (const f of report.kind === "audit" ? [] : report.findings) {
    line(
      `${f.dataset} | ${f.test} | ${f.ref || "—"} | ${sevWord[f.severity]} | ${f.detail || "—"}`,
      11,
    );
    line(`الجدول: ${datasetLabel(f.dataset)}`, 10, 9);
  }
  if (report.kind !== "audit" && !report.findings.length)
    line("لا توجد ملاحظات في هذا التقرير.");
  if (report.observations?.length) {
    line("الملاحظات الرقابية", 15, 10);
    for (const [oi, o] of report.observations.entries()) {
      observationLines(o, sevWord, oi + 1).forEach((t, i) => {
        const chunks = t.match(/.{1,70}(\s|$)/g) ?? [t];
        chunks.forEach((c) => line(c.trim(), i === 0 ? 12 : 10, i === 0 ? 7 : 6));
      });
      y += 4;
    }
  }
  doc.save(`${report.name}.pdf`);
}
function parseReportText(text) {
  const out = [];
  const sevOf = (s) =>
    /مرتفع/.test(s)
      ? "high"
      : /متوسط/.test(s)
        ? "medium"
        : /منخفض/.test(s)
          ? "low"
          : void 0;
  for (const raw of text.split("\n")) {
    const line = fromVisual(raw.trim());
    const sev = sevOf(line);
    if (!sev) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 4 && /^[A-Za-z_]+$/.test(parts[0]))
      out.push({
        dataset: parts[0],
        test: parts[1],
        ref: parts[2] === "—" ? "" : (parts[2] ?? ""),
        severity: sev,
        detail: parts.slice(4).join(" | ").replace("—", "").trim(),
      });
    else
      out.push({
        dataset: "",
        test: line.slice(0, 120),
        ref: "",
        severity: sev,
        detail: "",
      });
  }
  return out;
}
var sevLabel = {
  high: "مرتفعة",
  medium: "متوسطة",
  low: "منخفضة",
  none: "لا ملاحظات",
};
var sevClass = {
  high: "sev-high",
  medium: "sev-medium",
  low: "sev-low",
  none: "bg-success-soft text-success",
};
var order = {
  high: 0,
  medium: 1,
  low: 2,
};
var paramFields = [
  {
    key: "depositGraceDays",
    label: "المهلة المسموحة بين القبض النقدي والإيداع (يوم)",
    min: 1,
  },
  {
    key: "staleChequeDays",
    label: "عمر الشيك المعلق المتقادم (يوم)",
    min: 1,
  },
  {
    key: "materialityPct",
    label: "حد الأهمية النسبية لفروقات التسويات والعهد (%)",
    min: 0.01,
  },
  {
    key: "reviewIntervalDays",
    label: "أقصى فترة بين الجرد المفاجئ أو الاستعاضة (يوم)",
    min: 1,
  },
  {
    key: "overtimeMaxHours",
    label: "الحد الأقصى لساعات الإضافي للموظف (0 = غير مفعل)",
    min: 0,
  },
  {
    key: "fuelTolerancePct",
    label: "نسبة التسامح في فرق كميات المحروقات بين النظام والمحطة (%)",
    min: 0,
  },
  {
    key: "contractFuelPrice",
    label: "سعر اللتر حسب العقد عند غيابه من الكشف (0 = غير مفعل)",
    min: 0,
  },
  {
    key: "workStartHour",
    label: "بداية الدوام الرسمي (ساعة 0-23)",
    min: 0,
  },
  {
    key: "workEndHour",
    label: "نهاية الدوام الرسمي (ساعة 0-23)",
    min: 1,
  },
  {
    key: "licenseWarnDays",
    label: "مهلة التنبيه قبل انتهاء الترخيص أو التأمين (يوم)",
    min: 0,
  },
  {
    key: "maintenanceMultiple",
    label: "مضاعف تضخم تكلفة صيانة الآلية مقارنة بوسيط الأسطول",
    min: 1,
  },
  {
    key: "directPurchaseCeiling",
    label: "سقف الشراء المباشر السنوي لكل مورد (0 = غير مفعل، يُدخله المدقق من التشريع النافذ)",
    min: 0,
  },
  {
    key: "splitWindowDays",
    label: "نافذة كشف تجزئة أوامر الشراء لنفس المورد (يوم)",
    min: 1,
  },
  {
    key: "concentrationPct",
    label: "نسبة تركّز المشتريات المباشرة على مورد واحد (%)",
    min: 1,
  },
  {
    key: "committeeRotationMax",
    label: "أقصى عدد عطاءات لعضو لجنة قبل وجوب التدوير",
    min: 2,
  },
  {
    key: "stagnantMonths",
    label: "مدة الركود المعيارية للمواد قبل التدوير أو الشطب (شهر)",
    min: 1,
  },
  {
    key: "overtimeConcentrationPct",
    label: "نسبة استحواذ موظف على إضافي القسم التي تستدعي التنبيه (%)",
    min: 1,
  },
];
var datasetLabel = (k) =>
  k === "manual"
    ? "ملاحظة مدقق (يدوية)"
    : (auditSectors.flatMap((s) => s.datasets).find((d) => d.key === k)?.label ?? k);
var sectorLabel = (k) => auditSectors.find((s) => s.key === k)?.label ?? k;
function SectorAudit({ auditTab }) {
  const [store, setStore] = (0, import_react.useState)({});
  const [reports, setReports] = (0, import_react.useState)([]);
  const [docs, setDocs] = (0, import_react.useState)([]);
  const [legalLinks, setLegalLinks] = (0, import_react.useState)(() => loadLinks());
  const [loaded, setLoaded] = (0, import_react.useState)(false);
  const [sectorKey, setSectorKey] = (0, import_react.useState)(
    auditSectors[0].key,
  );
  const sector = auditSectors.find((s) => s.key === sectorKey);
  const [dsKey, setDsKey] = (0, import_react.useState)(sector.datasets[0].key);
  const ds = sector.datasets.find((d) => d.key === dsKey) ?? sector.datasets[0];
  const [draft, setDraft] = (0, import_react.useState)({});
  const [msg, setMsg] = (0, import_react.useState)("");
  const [importMsg, setImportMsg] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [params, setParams] = (0, import_react.useState)(defaultParams);
  const [calibration, setCalibration] = (0, import_react.useState)(defaultCalibration);
  const [alertMsg, setAlertMsg] = (0, import_react.useState)("");
  const [rejectedLog, setRejectedLog] = (0, import_react.useState)(null);
  const [demoActive, setDemoActive] = (0, import_react.useState)(false);
  const [hasDemoSnapshot, setHasDemoSnapshot] = (0, import_react.useState)(false);
  const [level, setLevel] = (0, import_react.useState)("all");
  const [sel, setSel] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const fileRef = (0, import_react.useRef)(null),
    pdfRef = (0, import_react.useRef)(null),
    reportRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    try {
      const v = JSON.parse(localStorage.getItem("rasd-audit-store") ?? "null");
      if (v && typeof v === "object") setStore(v);
    } catch {
      setStore({});
    }
    try {
      const v = JSON.parse(localStorage.getItem("rasd-audit-params") ?? "null");
      if (v && typeof v === "object")
        setParams({
          ...defaultParams,
          ...v,
        });
    } catch {
      setParams(defaultParams);
    }
    setCalibration(loadCalibration());
    setReports(loadReports());
    listRegulations()
      .then(setDocs)
      .catch(() => {});
    try {
      setDemoActive(localStorage.getItem(DEMO_FLAG_KEY) === "1");
      setHasDemoSnapshot(!!localStorage.getItem(DEMO_SNAPSHOT_KEY));
    } catch {
      /* storage unavailable */
    }
    setLoaded(true);
  }, []);
  (0, import_react.useEffect)(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("rasd-audit-store", JSON.stringify(store));
    } catch {
      setAlertMsg(
        "تعذر حفظ البيانات في المتصفح (امتلأت المساحة). نزّل نسخة احتياطية من تبويب «التقارير السابقة» الآن.",
      );
    }
  }, [store, loaded]);
  (0, import_react.useEffect)(() => {
    if (loaded)
      localStorage.setItem("rasd-audit-params", JSON.stringify(params));
  }, [params, loaded]);
  (0, import_react.useEffect)(() => {
    if (loaded) storeReports(reports);
  }, [reports, loaded]);
  (0, import_react.useEffect)(() => {
    if (loaded) saveCalibration(calibration);
  }, [calibration, loaded]);
  const segmented = (0, import_react.useMemo)(
    () =>
      docs.map((d) => ({
        id: d.id,
        name: d.name,
        segments: segmentDoc(d.text),
      })),
    [docs],
  );
  const historyIndex = (0, import_react.useMemo)(
    () => buildHistoryIndex(reports),
    [reports],
  );
  const findings = (0, import_react.useMemo)(() => {
    const lastName = historyIndex.last?.name ?? "";
    const base = runAudit(store, Date.now(), params).map((f) => {
      const d = auditSectors
        .flatMap((s) => s.datasets)
        .find((x) => x.key === f.dataset);
      const row = store[f.dataset]?.[f.row] ?? {};
      const ref = d ? (row[d.fields[0].key] ?? "") : "";
      return {
        ...f,
        ref,
        key: findingKey(f.dataset, f.test, ref),
        impact: impactAmount(f, row, d ? valueKeyOf(d) : void 0),
        regulation:
          linkedRegulation(legalLinks, f.dataset, f.test) ??
          matchRegulation(f.test, segmented),
        legal: legalFrameworkOf(f),
      };
    });
    return classifyFindings(base, historyIndex)
      .map((f) => {
        const cal = calibrateSeverity(
          f.severity,
          {
            exactCount: f.history.exactCount,
            patternCount: f.history.patternCount,
            amount: f.impact,
          },
          calibration,
        );
        const st = f.history.status;
        return {
          ...f,
          calibration: cal,
          finalSeverity: cal.severity,
          repeat:
            st === "recurring"
              ? { report: f.history.reports.at(-1)?.name ?? lastName, exact: true }
              : st === "pattern"
                ? { report: f.history.reports.at(-1)?.name ?? lastName, exact: false }
                : void 0,
        };
      })
      .sort((a, b) => order[a.finalSeverity] - order[b.finalSeverity]);
  }, [store, historyIndex, segmented, params, calibration, legalLinks]);
  // ملخص بيانات التدقيق للمساعد الذكي (تحليل ودردشة)
  (0, import_react.useEffect)(() => {
    if (!loaded) return;
    publishAssistantContext(
      "audit",
      summarizeAudit(store, findings, allDatasets, sectorLabel),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findings, store, loaded]);
  const rows = store[ds.key] ?? [];
  const sectorFindings = (0, import_react.useMemo)(
    () => findings.filter((f) => f.sector === sectorKey),
    [findings, sectorKey],
  );
  const sectorStore = (0, import_react.useMemo)(
    () =>
      Object.fromEntries(
        sector.datasets.map((x) => [x.key, store[x.key] ?? []]),
      ),
    [store, sector],
  );
  const dsFindings = findings.filter((f) => f.dataset === ds.key);
  const historyResult = (0, import_react.useMemo)(() => {
    const active = new Set(
      Object.entries(store)
        .filter(([, rs]) => Array.isArray(rs) && rs.length)
        .map(([k]) => k),
    );
    return resolvedFindings(
      historyIndex,
      new Set(findings.map((f) => f.key)),
      active,
    );
  }, [historyIndex, findings, store]);
  const resolved = historyResult.resolved;
  const historyStats = (0, import_react.useMemo)(
    () => historySummary(findings, resolved),
    [findings, resolved],
  );
  const repeated = sectorFindings.filter((f) => f.repeat).length;
  const [approvedObs, setApprovedObs] = (0, import_react.useState)(() => loadIds("approved"));
  const [deletedObs, setDeletedObs] = (0, import_react.useState)(() => loadIds("deleted"));
  const [reviewLog, setReviewLog] = (0, import_react.useState)(() => loadReviewLog());
  (0, import_react.useEffect)(() => {
    // وكيل المساعد قد يسجّل قرارًا خارج هذه الحالة؛ نعيد القراءة من التخزين عند إشعاره
    const reload = () => {
      setReviewLog(loadReviewLog());
      setDeletedObs(loadIds("deleted"));
    };
    window.addEventListener("rasd-agent-write", reload);
    return () => window.removeEventListener("rasd-agent-write", reload);
  }, []);
  const [reviewThreshold, setReviewThreshold] = (0, import_react.useState)(() => loadThreshold());
  const allObservations = (0, import_react.useMemo)(
    () =>
      auditSectors.flatMap((s) =>
        draftObservations(
          findings.filter((f) => f.sector === s.key),
          {
            datasetLabel,
            totalRecords: s.datasets.reduce(
              (a, x) => a + (store[x.key]?.length ?? 0),
              0,
            ),
            approved: approvedObs,
          },
        ),
      ),
    [findings, store, approvedObs],
  );
  // ملاحظات كتبها المدقق واعتمدها نهائيًا من المساعد («مسودة مدقق»): تُدمج مع ملاحظات المحرك
  const manualObs = useManualObservations();
  (0, import_react.useEffect)(() => {
    setApprovedObs(loadIds("approved"));
  }, [manualObs]);
  const sectorObservations = (0, import_react.useMemo)(
    () =>
      [
        ...allObservations.filter((o) => o.sector === sectorKey),
        ...manualObs
          .filter((o) => o.sector === sectorKey)
          .map((o) => ({ ...o, status: approvedObs.has(o.id) ? "approved" : "draft" })),
      ].sort((a, b) => b.risk.score - a.risk.score || b.count - a.count),
    [allObservations, sectorKey, manualObs, approvedObs],
  );
  const observations = (0, import_react.useMemo)(
    () => sectorObservations.filter((o) => !deletedObs.has(o.id)),
    [sectorObservations, deletedObs],
  );
  const deletedCount = sectorObservations.length - observations.length;
  const obsDecisions = (0, import_react.useMemo)(
    () =>
      Object.fromEntries(
        sectorObservations.map((o) => [o.id, decisionFor(reviewLog, o)]).filter(([, d]) => d),
      ),
    [sectorObservations, reviewLog],
  );
  // إنذار كاذب أُخفي سابقًا ثم تغيّرت بيانات الملاحظة (سجلات جديدة): يُعاد إظهارها للمراجعة
  (0, import_react.useEffect)(() => {
    const ids = staleHiddenIds(reviewLog, sectorObservations).filter((id) => deletedObs.has(id));
    if (!ids.length) return;
    const n = new Set(deletedObs);
    ids.forEach((id) => n.delete(id));
    saveIds("deleted", n);
    setDeletedObs(n);
    let nl = reviewLog;
    for (const o of sectorObservations.filter((x) => ids.includes(x.id))) {
      const d = decisionFor(nl, o);
      if (d) nl = nl.map((e) => (e.id === d.id ? { ...e, autoHidden: false } : e));
    }
    saveReviewLog(nl);
    setReviewLog(nl);
  }, [reviewLog, sectorObservations]);
  const decideObservation = (o, decision, note = "") => {
    const isFp = decision === "false_positive";
    const nl = recordDecision(loadReviewLog(), {
      dataset: o.dataset,
      test: o.test,
      ref: o.id,
      decision,
      note,
      fingerprint: observationFingerprint(o),
      autoHidden: isFp,
    });
    saveReviewLog(nl);
    setReviewLog(nl);
    trackEvent(isFp ? "ui.finding.false_positive" : "ui.finding.confirm", o.id, `${o.dataset}|${o.test}`);
    if (isFp) {
      const n = new Set(loadIds("deleted")).add(o.id);
      saveIds("deleted", n);
      setDeletedObs(n);
    }
  };
  (0, import_react.useEffect)(() => {
    const comp = complianceOf(store, findings);
    if (comp.total > 0)
      saveDraft({
        date: new Date().toISOString().slice(0, 10),
        observations: allObservations,
        compliance: comp,
      });
  }, [allObservations]);
  const toggleApprove = (id) => {
    const n = new Set(approvedObs);
    n.has(id) ? n.delete(id) : n.add(id);
    saveIds("approved", n);
    setApprovedObs(n);
  };
  const counts = {
    high: sectorFindings.filter((f) => f.finalSeverity === "high").length,
    medium: sectorFindings.filter((f) => f.finalSeverity === "medium").length,
    low: sectorFindings.filter((f) => f.finalSeverity === "low").length,
  };
  const visible =
    level === "all"
      ? sectorFindings
      : sectorFindings.filter((f) => f.finalSeverity === level);
  const linked = sectorFindings.filter((f) => f.regulation).length;
  function applyDemo() {
    const { store: demoStore, params: demoParams, base, report } = buildDemoBundle();
    setStore(demoStore);
    setParams(demoParams);
    setReports(mergeSeedReports([report]));
    try {
      localStorage.setItem(DEMO_FLAG_KEY, "1");
    } catch {
      /* the banner just won't survive a reload */
    }
    setDemoActive(true);
    setSectorKey(auditSectors[0].key);
    setDsKey(auditSectors[0].datasets[0].key);
    setDraft({});
    setLevel("all");
    setSel(/* @__PURE__ */ new Set());
    const records = Object.values(demoStore).reduce((a, r) => a + r.length, 0);
    const high = base.filter((f) => f.severity === "high").length;
    setMsg(`تم تحميل العرض التجريبي: ${records} سجلًا افتراضيًا كشف المحرك فيها ${base.length} ملاحظة (${high} مرتفعة الخطورة).`);
  }
  function loadDemo() {
    const hasData = Object.values(store).some((r) => Array.isArray(r) && r.length) || reports.some((r) => !r.seed);
    if (hasData && !demoActive) {
      if (!window.confirm("سيحلّ العرض التجريبي مكان بياناتك وتقاريرك الحالية مؤقتًا. تُحفظ بياناتك كما هي وتعود عند الضغط على «الخروج واستعادة بياناتي». متابعة؟")) return;
      try {
        localStorage.setItem(DEMO_SNAPSHOT_KEY, JSON.stringify({ store, reports, params }));
        setHasDemoSnapshot(true);
      } catch {
        setMsg("تعذّر حفظ بياناتك الحالية قبل العرض (المساحة ممتلئة). نزّل نسخة احتياطية من تبويب «التقارير السابقة» ثم أعد المحاولة.");
        return;
      }
    }
    applyDemo();
  }
  function exitDemo() {
    if (!window.confirm("سيُحذف العرض التجريبي وأي تقارير حفظتها أثناءه. متابعة؟")) return;
    let snap = null;
    try {
      snap = JSON.parse(localStorage.getItem(DEMO_SNAPSHOT_KEY) ?? "null");
    } catch {
      snap = null;
    }
    setStore(snap?.store ?? {});
    setReports(mergeSeedReports(snap?.reports ?? []));
    setParams({ ...defaultParams, ...(snap?.params ?? {}) });
    try {
      localStorage.removeItem(DEMO_SNAPSHOT_KEY);
      localStorage.removeItem(DEMO_FLAG_KEY);
    } catch {
      /* ignore */
    }
    setHasDemoSnapshot(false);
    setDemoActive(false);
    setMsg(snap ? "تمت استعادة بياناتك وتقاريرك كما كانت قبل العرض." : "تم الخروج من العرض التجريبي.");
  }
  function pickSector(k) {
    const s = auditSectors.find((x) => x.key === k);
    setSectorKey(k);
    setDsKey(s.datasets[0].key);
    setDraft({});
    setLevel("all");
    setSel(/* @__PURE__ */ new Set());
  }
  function deleteRows(idx) {
    if (!idx.size) return;
    setStore((p) => ({
      ...p,
      [ds.key]: (p[ds.key] ?? []).filter((_, j) => !idx.has(j)),
    }));
    setSel(/* @__PURE__ */ new Set());
  }
  function deleteAllRows() {
    if (!rows.length) return;
    if (!window.confirm(`حذف جميع سجلات «${ds.label}» (${rows.length} سجل)؟ لا يمكن التراجع.`))
      return;
    deleteRows(new Set(rows.map((_, j) => j)));
    setMsg(`تم حذف جميع سجلات ${ds.label}`);
  }
  function add(e) {
    e.preventDefault();
    if (!ds.fields.some((f) => draft[f.key]?.trim())) return;
    const missing = missingRequired(ds, draft);
    if (missing.length) {
      setAlertMsg(
        `تنبيه: رُفض السجل لنقص حقول جوهرية في «${ds.label}» — ${missing.join("، ")}. أكمل الحقول ثم احفظ.`,
      );
      return;
    }
    setAlertMsg("");
    setStore((p) => ({
      ...p,
      [ds.key]: [...(p[ds.key] ?? []), draft],
    }));
    setDraft({});
  }
  function saveCsv(name, csv) {
    const url = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3e4);
  }
  const findingRow = (f) => ({
    "النشاط / العملية": sectorLabel(f.sector),
    الجدول: datasetLabel(f.dataset),
    "رمز الجدول": f.dataset,
    المعرّف: f.ref,
    "رقم السجل": f.row + 1,
    الاختبار: f.test,
    التفاصيل: f.detail,
    "المخاطر الأساسية": sevLabel[f.severity],
    "المخاطر النهائية": sevLabel[f.finalSeverity],
    "المقارنة بالتقارير السابقة": f.repeat
      ? `${f.repeat.exact ? "متكررة" : "نمط متكرر"} — ${f.repeat.report}`
      : "جديدة",
    "المرجع النظامي": f.regulation
      ? `${f.regulation.doc}: ${f.regulation.excerpt}`
      : "",
    "السند القانوني": legalTextOf(f),
    "الحالة التاريخية": f.history ? STATUS_LABEL[f.history.status] : "",
    "الأثر المالي": f.impact || "",
    "تفسير الخطورة النهائية": f.calibration?.explain ?? "",
  });
  async function exportExcel(only) {
    const X = await import("xlsx");
    const wb = X.utils.book_new();
    for (const s of auditSectors)
      for (const d of s.datasets) {
        if (only && d.key !== only) continue;
        const rs = store[d.key] ?? [];
        if (only || rs.length)
          X.utils.book_append_sheet(
            wb,
            X.utils.json_to_sheet(
              rs.map((r) =>
                Object.fromEntries(
                  d.fields.map((f) => [f.label, r[f.key] ?? ""]),
                ),
              ),
            ),
            d.key.slice(0, 31),
          );
      }
    if (!only && findings.length)
      X.utils.book_append_sheet(
        wb,
        X.utils.json_to_sheet(findings.map(findingRow)),
        "نتائج التدقيق",
      );
    if (!wb.SheetNames.length) {
      setMsg("لا توجد بيانات للتصدير");
      return;
    }
    X.writeFile(wb, only ? `${only}.xlsx` : "rasd-audit.xlsx");
  }
  async function importFile(file) {
    if (!file) return;
    setImportMsg("جارٍ قراءة الملف...");
    try {
      const addRows = (list) => {
        const rejectedAll = [];
        const accepted = list.map((it) => {
          const dset = allDatasets.find((x) => x.key === it.key);
          if (!dset) return it;
          const part = partitionRecords(dset, it.rows);
          if (part.rejected.length) rejectedAll.push({ ds: dset, rejected: part.rejected });
          return { ...it, rows: part.accepted };
        });
        setStore((p) => {
          const next = { ...p };
          for (const it of accepted)
            next[it.key] = [...(next[it.key] ?? []), ...it.rows];
          return next;
        });
        if (rejectedAll.length) {
          setRejectedLog(rejectedAll);
          setAlertMsg(
            rejectedAll
              .map((x) => rejectionMessage(x.ds, x.rejected))
              .join(" "),
          );
        } else {
          setRejectedLog(null);
          setAlertMsg("");
        }
      };
      if (/\.(xlsx?|json|xml)$/i.test(file.name)) {
        let mapped;
        if (/\.json$/i.test(file.name)) {
          mapped = mapSheets(jsonToSheets(await file.text()), allDatasets, ds.key);
        } else if (/\.xml$/i.test(file.name)) {
          mapped = mapSheets(xmlToSheets(await file.text()), allDatasets, ds.key);
        } else {
          const X = await import("xlsx");
          const wb = X.read(await file.arrayBuffer(), { type: "array" });
          mapped = mapWorkbook(X, wb, allDatasets, ds.key);
        }
        const { imports, unmatched } = mapped;
        if (!imports.length) {
          const first = unmatched[0];
          throw Error(
            `لم يتم التعرف على أي جدول في الملف. ` +
              `الأعمدة المطلوبة لجدول «${ds.label}»: ${ds.fields.map((f) => f.label).join("، ")}.` +
              (first?.headers?.length
                ? ` الأعمدة الموجودة في الورقة «${first.sheet}»: ${first.headers.join("، ")}.`
                : " الملف فارغ أو لا يحتوي عناوين أعمدة."),
          );
        }
        addRows(imports);
        const total = imports.reduce((a, i) => a + i.rows.length, 0);
        const lines = imports.map(
          (i) =>
            `«${i.sheet}» ← ${i.label}: ${i.rows.length} سجل (${i.matched}/${i.total} عمود)`,
        );
        const skipped = unmatched.length
          ? ` | أوراق لم تُطابق أي جدول: ${unmatched.map((u) => u.sheet).join("، ")}`
          : "";
        const target = imports.find((i) => i.key === ds.key);
        if (!target && imports[0]) setDsKey(imports[0].key);
        setImportMsg(`تم استيراد ${total} سجل — ${lines.join(" | ")}${skipped}`);
        return;
      }
      let data = [];
      if (/\.csv$/i.test(file.name)) {
        const aoa = import_papaparse.default.parse(await file.text(), {
          header: false,
          skipEmptyLines: true,
        }).data;
        const r = await rowsFromAoaChunked(aoa, ds.fields, {
          onProgress: (p) => setImportMsg(`جارٍ معالجة السجلات... ${Math.round(p * 100)}%`),
        });
        if (!r.rows.length)
          throw Error(
            `لم يتم العثور على أعمدة مطابقة لجدول «${ds.label}». المطلوب: ${ds.fields.map((f) => f.label).join("، ")}.`,
          );
        addRows([{ key: ds.key, rows: r.rows }]);
        setImportMsg(`تم استيراد ${r.rows.length} سجل إلى «${ds.label}»`);
        return;
      } else if (/\.pdf$/i.test(file.name)) {
        data = await extractPdfRows(file, ds.fields, setImportMsg);
      } else throw Error("صيغة غير مدعومة. استخدم Excel أو CSV أو JSON أو XML أو PDF");
      const valid = data
        .map((r) =>
          Object.fromEntries(
            ds.fields.map((f) => [
              f.key,
              String(r[f.label] ?? r[f.key] ?? "").trim(),
            ]),
          ),
        )
        .filter((r) => Object.values(r).some(Boolean));
      if (!valid.length)
        throw Error("لم يتم العثور على أعمدة مطابقة. استخدم قالب الأعمدة.");
      addRows([{ key: ds.key, rows: valid }]);
      setImportMsg(`تم استيراد ${valid.length} سجل`);
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "تعذر قراءة الملف");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function addPdfs(files) {
    if (!files?.length) return;
    setBusy(true);
    setMsg("");
    try {
      for (const file of Array.from(files)) {
        if (!/\.pdf$/i.test(file.name)) continue;
        const extracted = await extractPdfPages(file, { onStatus: setMsg });
        const text = extracted.text;
        await saveRegulation({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.pdf$/i, ""),
          text,
          addedAt: /* @__PURE__ */ new Date().toISOString().slice(0, 10),
          blob: file,
        });
        if (!text.trim())
          setMsg(
            `تم حفظ ${file.name} لكن لم يُستخرج منه نص حتى بعد OCR (تحقق من جودة المسح أو من الاتصال بالإنترنت)`,
          );
        else if (extracted.garbledPages.length)
          setMsg(
            `تم حفظ ${file.name}، لكن نص ${extracted.garbledPages.length} صفحة منه ما زال مشوّهًا ولن يُعرض كسند قانوني. اتصل بالإنترنت (لتفعيل OCR) وأعد رفع الملف.`,
          );
        else if (extracted.repairedPages.length)
          setMsg(
            `تم حفظ ${file.name} وإصلاح الحروف المتكررة في ${extracted.repairedPages.length} صفحة بصورة تقريبية. لنص أدق اتصل بالإنترنت وأعد رفع الملف ليُقرأ بـ OCR.`,
          );
        else if (extracted.ocrPages.length)
          setMsg(`تم حفظ ${file.name} (قُرئت ${extracted.ocrPages.length} صفحة بـ OCR)`);
      }
      setDocs(await listRegulations());
    } catch {
      setMsg("تعذر قراءة ملف PDF");
    } finally {
      setBusy(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  }
  async function saveReport() {
    if (!sectorFindings.length) {
      setMsg("لا توجد ملاحظات لحفظها في هذا النشاط");
      return;
    }
    const date = /* @__PURE__ */ new Date().toISOString().slice(0, 10);
    const report = {
      id: crypto.randomUUID(),
      name: `تقرير ${sector.label} ${date} (${reports.length + 1})`,
      date,
      compliance: complianceOf(sectorStore, sectorFindings),
      findings: sectorFindings.map((f) => ({
        key: f.key,
        dataset: f.dataset,
        test: f.test,
        ref: f.ref,
        severity: f.finalSeverity,
        detail: f.detail,
      })),
      observations,
    };
    setReports((p) => [...p, report]);
    try {
      await downloadReportPdf(report, datasetLabel);
      setMsg("تم حفظ التقرير وتنزيله كملف PDF");
    } catch {
      setMsg("تم حفظ التقرير، لكن تعذر إنشاء ملف PDF");
    }
  }
  async function importReport(file) {
    if (!file) return;
    try {
      if (!/\.pdf$/i.test(file.name)) throw Error();
      const fs = parseReportText(await extractPdfText(file)).map((f) => ({
        ...f,
        key: findingKey(f.dataset, f.test, f.ref),
      }));
      if (!fs.length) throw Error();
      setReports((p) => [
        ...p,
        {
          id: crypto.randomUUID(),
          name: file.name.replace(/\.pdf$/i, ""),
          date: new Date(file.lastModified).toISOString().slice(0, 10),
          findings: fs,
        },
      ]);
      setMsg(`تم استيراد تقرير سابق يحتوي ${fs.length} ملاحظة`);
    } catch {
      setMsg(
        "تعذر قراءة التقرير. استخدم ملف PDF مصدّر من رصد أو يحتوي ملاحظات بمستويات مخاطر.",
      );
    } finally {
      if (reportRef.current) reportRef.current.value = "";
    }
  }
  function openDoc(id) {
    const d = docs.find((x) => x.id === id);
    if (!d) return;
    const url = URL.createObjectURL(d.blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 6e4);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "view-heading",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
                children: "تدقيق الأنشطة والعمليات",
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                className: "mt-2 text-xs text-muted-foreground",
                children:
                  "بيانات الأنشطة والعمليات مرتبطة بالأنظمة والتعليمات والتقارير السابقة لتقييم المخاطر.",
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "header-actions",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                variant: "outline",
                onClick: saveReport,
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, {}),
                  "حفظ كتقرير",
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                variant: "ink",
                onClick: () => exportExcel(),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {}),
                  "تصدير الكل Excel",
                ],
              }),
            ],
          }),
        ],
      }),
      msg &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          role: "status",
          className: "mb-4 rounded-md bg-muted px-4 py-3 text-xs",
          children: msg,
        }),
      auditTab === "audit" &&
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RejectedAlert, {
        message: alertMsg,
        rejectedLog,
        Button,
        onDismiss: () => setAlertMsg(""),
        onDownload: () => {
          const csv = (rejectedLog ?? [])
            .map((x) => `# ${x.ds.label}\n${rejectedToCsv(x.ds, x.rejected)}`)
            .join("\n\n");
          const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = "rejected-records.csv";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 6e4);
        },
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoBar, {
        Button,
        active: demoActive,
        hasData:
          Object.values(store).some((r) => Array.isArray(r) && r.length) ||
          reports.some((r) => !r.seed),
        hasSnapshot: hasDemoSnapshot,
        summary: `${findings.length} ملاحظة مكتشفة حاليًا.`,
        onLoad: loadDemo,
        onExit: exitDemo,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
        className: "stats-grid",
        children: auditSectors.map((s) => {
          const fs = findings.filter((f) => f.sector === s.key);
          const lv = fs.some((f) => f.finalSeverity === "high")
            ? "high"
            : riskLevel(fs);
          const count = s.datasets.reduce(
            (a, d) => a + (store[d.key]?.length ?? 0),
            0,
          );
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              onClick: () => pickSector(s.key),
              className: "stat-card text-start",
              style:
                s.key === sectorKey ? { borderColor: "var(--ink)" } : void 0,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                  className: "text-xs font-semibold",
                  children: s.label,
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                  className: "mt-1 text-[10px] text-muted-foreground",
                  dir: "ltr",
                  children: s.en,
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                  className:
                    "mt-3 flex items-center justify-between gap-2 text-xs",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
                      children: [count, " سجل · ", fs.length, " ملاحظة"],
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                      className: `status-badge ${count ? sevClass[lv] : "bg-muted text-muted-foreground"}`,
                      children: count ? sevLabel[lv] : "غير مقيّم",
                    }),
                  ],
                }),
              ],
            },
            s.key,
          );
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "table-panel stat-card",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
            className: "text-base font-semibold",
            children: sector.label,
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "mt-1 text-xs text-muted-foreground",
            children: sector.goal,
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "mt-4 flex flex-wrap gap-2",
            children: sector.datasets.map((d) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                Button,
                {
                  size: "sm",
                  variant: d.key === ds.key ? "ink" : "outline",
                  onClick: () => {
                    setDsKey(d.key);
                    setDraft({});
                    setSel(/* @__PURE__ */ new Set());
                  },
                  children: [
                    d.label,
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
                      className: "text-[10px] opacity-70",
                      children: ["(", store[d.key]?.length ?? 0, ")"],
                    }),
                  ],
                },
                d.key,
              ),
            ),
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "table-panel stat-card",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "flex flex-wrap items-center justify-between gap-3",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
                    className: "font-semibold",
                    children: ds.label,
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    className: "text-[10px] text-muted-foreground",
                    dir: "ltr",
                    children: ds.key,
                  }),
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                className: "flex flex-wrap gap-2",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    onClick: () =>
                      saveCsv(
                        `${ds.key}-template.csv`,
                        import_papaparse.default.unparse({
                          fields: ds.fields.map((f) => f.label),
                          data: [],
                        }),
                      ),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDown, {}),
                      "قالب الأعمدة",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    disabled: !rows.length,
                    onClick: () => exportExcel(ds.key),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {}),
                      "تصدير الجدول Excel",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    onClick: () => fileRef.current?.click(),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {}),
                      "استيراد Excel / PDF",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                    ref: fileRef,
                    type: "file",
                    accept: ".csv,.xlsx,.xls,.json,.xml,.pdf,application/pdf",
                    hidden: true,
                    onChange: (e) => importFile(e.target.files?.[0]),
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    disabled: !sel.size,
                    onClick: () => deleteRows(sel),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {}),
                      `حذف المحدد (${sel.size})`,
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    disabled: !rows.length,
                    onClick: deleteAllRows,
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {}),
                      "حذف كل السجلات",
                    ],
                  }),
                ],
              }),
            ],
          }),
          importMsg &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
              role: "status",
              className: "mt-3 rounded-md bg-muted px-4 py-3 text-xs leading-6",
              children: importMsg,
            }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
            onSubmit: add,
            className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
            children: [
              ds.fields.map((f) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "label",
                  {
                    className: "grid gap-1 text-xs",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                        children: f.label,
                      }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                        className: "field-input",
                        type:
                          f.type === "date"
                            ? "date"
                            : f.type === "number"
                              ? "number"
                              : "text",
                        step: "any",
                        value: draft[f.key] ?? "",
                        onChange: (e) =>
                          setDraft((p) => ({
                            ...p,
                            [f.key]: e.target.value,
                          })),
                      }),
                    ],
                  },
                  f.key,
                ),
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                className: "flex items-end",
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                  type: "submit",
                  variant: "ink",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {}),
                    "إضافة سجل",
                  ],
                }),
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "table-scroll mt-4",
            children: rows.length
              ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
                  className: "data-table",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "tr",
                        {
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
                              children: [
                                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                                  type: "checkbox",
                                  "aria-label": "تحديد الكل",
                                  checked: rows.length > 0 && sel.size === rows.length,
                                  onChange: (e) =>
                                    setSel(
                                      e.target.checked
                                        ? new Set(rows.map((_, j) => j))
                                        : /* @__PURE__ */ new Set(),
                                    ),
                                }),
                                " #",
                              ],
                            }),
                            ds.fields.map((f) =>
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "th",
                                { children: f.label },
                                f.key,
                              ),
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "المخاطر",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "th",
                              {},
                            ),
                          ],
                        },
                      ),
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
                      children: rows.map((r, i) => {
                        const fs = dsFindings.filter((f) => f.row === i);
                        const lv = fs.some((f) => f.finalSeverity === "high")
                          ? "high"
                          : riskLevel(fs);
                        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                          "tr",
                          {
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                                "td",
                                {
                                  children: [
                                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                                      type: "checkbox",
                                      "aria-label": `تحديد السجل ${i + 1}`,
                                      checked: sel.has(i),
                                      onChange: (e) =>
                                        setSel((p) => {
                                          const n2 = new Set(p);
                                          e.target.checked ? n2.add(i) : n2.delete(i);
                                          return n2;
                                        }),
                                    }),
                                    " ",
                                    i + 1,
                                  ],
                                },
                              ),
                              ds.fields.map((f) =>
                                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                  "td",
                                  { children: r[f.key] },
                                  f.key,
                                ),
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                {
                                  children: /* @__PURE__ */ (0,
                                  import_jsx_runtime.jsx)("span", {
                                    className: `status-badge ${sevClass[lv]}`,
                                    children: sevLabel[lv],
                                  }),
                                },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                {
                                  children: /* @__PURE__ */ (0,
                                  import_jsx_runtime.jsx)(Button, {
                                    variant: "ghost",
                                    size: "icon",
                                    "aria-label": "حذف",
                                    onClick: () => deleteRows(/* @__PURE__ */ new Set([i])),
                                    children: /* @__PURE__ */ (0,
                                    import_jsx_runtime.jsx)(Trash2, {}),
                                  }),
                                },
                              ),
                            ],
                          },
                          i,
                        );
                      }),
                    }),
                  ],
                })
              : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                  className: "py-6 text-center text-xs text-muted-foreground",
                  children: "لا توجد سجلات بعد. أضف سجلًا أو استورد ملفًا.",
                }),
          }),
        ],
      }),
        ],
      }),
      auditTab !== "audit" &&
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "analysis-grid",
        children: [
          auditTab === "rules" &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "table-panel stat-card",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                className: "flex flex-wrap items-center justify-between gap-2",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
                    className: "flex items-center gap-2 font-semibold",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, {
                        size: 18,
                      }),
                      "الأنظمة والتعليمات",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    disabled: busy,
                    onClick: () => pdfRef.current?.click(),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {}),
                      busy ? "جارٍ القراءة…" : "رفع ملفات PDF",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                    ref: pdfRef,
                    type: "file",
                    accept: "application/pdf,.pdf",
                    multiple: true,
                    hidden: true,
                    onChange: (e) => addPdfs(e.target.files),
                  }),
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                className: "mt-1 text-xs text-muted-foreground",
                children:
                  "تُقرأ نصوص الملفات وتُربط كل ملاحظة بأقرب مادة أو فقرة ذات صلة.",
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
                className: "mt-3 space-y-2 text-xs",
                children: docs.length
                  ? docs.map((d) =>
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "li",
                        {
                          className: "flex flex-wrap items-center gap-2",
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              FileText,
                              { size: 15 },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "button",
                              {
                                className:
                                  "flex-1 truncate text-start underline-offset-4 hover:underline",
                                onClick: () => openDoc(d.id),
                                children: d.name,
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "span",
                              {
                                className: "text-muted-foreground",
                                children: d.text.trim()
                                  ? `${segmentDoc(d.text).length} فقرة`
                                  : "بلا نص",
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              Button,
                              {
                                variant: "ghost",
                                size: "icon",
                                "aria-label": `حذف ${d.name}`,
                                onClick: async () => {
                                  await deleteRegulation(d.id);
                                  setDocs(await listRegulations());
                                },
                                children: /* @__PURE__ */ (0,
                                import_jsx_runtime.jsx)(Trash2, {}),
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryMeta, {
                              doc: d,
                              onChange: async (patch) => {
                                await updateRegulationMeta(d.id, patch);
                                setDocs(await listRegulations());
                              },
                            }),
                          ],
                        },
                        d.id,
                      ),
                    )
                  : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
                      className: "text-muted-foreground",
                      children: "لم تُرفع أنظمة بعد.",
                    }),
              }),
            ],
          }),
          auditTab === "reports" &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "table-panel stat-card",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                className: "flex flex-wrap items-center justify-between gap-2",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
                    className: "flex items-center gap-2 font-semibold",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, {
                        size: 18,
                      }),
                      "التقارير السابقة",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "outline",
                    size: "sm",
                    onClick: () => reportRef.current?.click(),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {}),
                      "استيراد تقرير PDF",
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                    ref: reportRef,
                    type: "file",
                    accept: "application/pdf,.pdf",
                    hidden: true,
                    onChange: (e) => importReport(e.target.files?.[0]),
                  }),
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                className: "mt-1 text-xs text-muted-foreground",
                children:
                  "الملاحظة المتكررة لنفس السجل ترفع مستوى المخاطر درجة واحدة.",
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackupPanel, {}),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
                className: "mt-3 space-y-2 text-xs",
                children: reports.length
                  ? reports.map((r) =>
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "li",
                        {
                          className: "flex items-center gap-2",
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "span",
                              {
                                className: "flex-1 truncate",
                                children: r.name,
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "span",
                              {
                                className: "text-muted-foreground",
                                dir: "ltr",
                                children: r.date,
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                              "span",
                              {
                                className: "text-muted-foreground",
                                children: [r.findings.length, " ملاحظة"],
                              },
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              Button,
                              {
                                variant: "ghost",
                                size: "icon",
                                "aria-label": `حذف ${r.name}`,
                                onClick: () => {
                                  markSeedRemoved(r.id);
                                  setReports((p) =>
                                    p.filter((x) => x.id !== r.id),
                                  );
                                },
                                children: /* @__PURE__ */ (0,
                                import_jsx_runtime.jsx)(Trash2, {}),
                              },
                            ),
                          ],
                        },
                        r.id,
                      ),
                    )
                  : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
                      className: "text-muted-foreground",
                      children: "لا توجد تقارير محفوظة.",
                    }),
              }),
              resolved.length > 0 &&
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
                  className: "mt-3 text-xs text-success",
                  children: [
                    resolved.length,
                    " ملاحظة من آخر تقرير لم تعد قائمة (تمت معالجتها).",
                  ],
                }),
            ],
          }),
        ],
      }),
      auditTab === "audit" &&
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        children: [
      sectorKey === "finance" &&
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "table-panel stat-card",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
            className: "flex items-center gap-2 font-semibold",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, {
                size: 18,
              }),
              "معاملات التدقيق",
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "mt-1 text-xs text-muted-foreground",
            children:
              "قيم تحددها أنت وتُستخدم في تصنيف التأخير والفروقات إلى مرتفعة ومتوسطة ومنخفضة.",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
            children: paramFields.map((f) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "label",
                {
                  className: "grid gap-1 text-xs",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                      children: f.label,
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                      className: "field-input",
                      type: "number",
                      min: f.min,
                      step: "any",
                      value: params[f.key],
                      onChange: (e) => {
                        const v = Number(e.target.value);
                        if (
                          e.target.value !== "" &&
                          Number.isFinite(v) &&
                          v >= f.min
                        )
                          setParams((p) => ({
                            ...p,
                            [f.key]: v,
                          }));
                      },
                    }),
                  ],
                },
                f.key,
              ),
            ),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "mt-3",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
              variant: "outline",
              size: "sm",
              onClick: () => setParams(defaultParams),
              children: "استعادة القيم الأولية",
            }),
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
        className: "stats-grid",
        children: [
          {
            k: "مرتفعة المخاطر",
            v: counts.high,
            l: "high",
          },
          {
            k: "متوسطة المخاطر",
            v: counts.medium,
            l: "medium",
          },
          {
            k: "منخفضة المخاطر",
            v: counts.low,
            l: "low",
          },
          {
            k: "إجمالي الملاحظات",
            v: sectorFindings.length,
            l: "all",
          },
        ].map((s) =>
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              type: "button",
              "aria-pressed": level === s.l,
              onClick: () => setLevel(level === s.l ? "all" : s.l),
              className: "stat-card text-start",
              style: level === s.l ? { borderColor: "var(--ink)" } : void 0,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                  className: "text-xs text-muted-foreground",
                  children: s.k,
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                  className: "stat-value",
                  dir: "ltr",
                  children: s.v,
                }),
              ],
            },
            s.k,
          ),
        ),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
        className: "-mt-3 mb-4 text-xs text-muted-foreground",
        children: [
          "متكررة من تقارير سابقة: ",
          repeated,
          " · مرتبطة بنص نظامي: ",
          linked,
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "table-panel stat-card",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "flex flex-wrap items-center justify-between gap-3",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
                className: "flex items-center gap-2 font-semibold",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
                    size: 18,
                  }),
                  "نتائج التحليل وتقييم المخاطر (",
                  visible.length,
                  ")",
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                className: "flex flex-wrap gap-2",
                children: ["all", "high", "medium", "low"].map((l) =>
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    Button,
                    {
                      size: "sm",
                      variant: level === l ? "ink" : "outline",
                      onClick: () => setLevel(l),
                      children: l === "all" ? "الكل" : sevLabel[l],
                    },
                    l,
                  ),
                ),
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "mt-1 text-xs text-muted-foreground",
            children:
              "اختبارات اتساق ومطابقة بين الجداول، مقارنة بالتقارير السابقة، وربط بالأنظمة المرفوعة.",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "table-scroll mt-4",
            children: visible.length
              ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
                  className: "data-table",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "tr",
                        {
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "المخاطر",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "الجدول",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "المعرّف",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "الاختبار",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "التفاصيل",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "مقارنة بالتقارير السابقة",
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
                              children: "المرجع النظامي",
                            }),
                          ],
                        },
                      ),
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
                      children: visible.map((f, i) =>
                        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                          "tr",
                          {
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                {
                                  children: /* @__PURE__ */ (0,
                                  import_jsx_runtime.jsx)("span", {
                                    className: `status-badge ${sevClass[f.finalSeverity]}`,
                                    children: sevLabel[f.finalSeverity],
                                  }),
                                },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                { children: datasetLabel(f.dataset) },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                { children: f.ref || f.row + 1 },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                { children: f.test },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                { children: f.detail },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                {
                                  children: f.repeat
                                    ? /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsxs)("span", {
                                        className:
                                          "status-badge bg-danger-soft text-danger",
                                        children: [
                                          f.repeat.exact
                                            ? "متكررة"
                                            : "نمط متكرر",
                                          " · ",
                                          f.repeat.report,
                                        ],
                                      })
                                    : /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)("span", {
                                        className:
                                          "status-badge bg-muted text-muted-foreground",
                                        children: "جديدة",
                                      }),
                                },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "td",
                                {
                                  className: "max-w-72 text-[11px]",
                                  children: f.regulation
                                    ? /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsxs)("button", {
                                        className: "text-start hover:underline",
                                        onClick: () =>
                                          openDoc(f.regulation.docId),
                                        children: [
                                          /* @__PURE__ */ (0,
                                          import_jsx_runtime.jsxs)("b", {
                                            children: [f.regulation.doc, ":"],
                                          }),
                                          " ",
                                          f.regulation.excerpt,
                                        ],
                                      })
                                    : /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)("span", {
                                        className: "text-muted-foreground",
                                        title: f.legal?.text,
                                        children: f.legal
                                          ? `${f.legal.instruments[0]} (${f.legal.note})`
                                          : "—",
                                      }),
                                },
                              ),
                            ],
                          },
                          i,
                        ),
                      ),
                    }),
                  ],
                })
              : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                  className: "py-6 text-center text-xs text-muted-foreground",
                  children: "لا توجد ملاحظات حالياً.",
                }),
          }),
          resolved.length > 0 &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
              className: "mt-4",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
                  className: "text-xs font-semibold",
                  children: ["ملاحظات معالجة منذ «", resolved[0].report, "»"],
                }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
                  className: "mt-2 space-y-1 text-xs text-muted-foreground",
                  children: resolved.map((r) =>
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      "li",
                      {
                        children: [
                          datasetLabel(r.dataset),
                          " · ",
                          r.ref,
                          " · ",
                          r.test,
                        ],
                      },
                      r.key,
                    ),
                  ),
                }),
              ],
            }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ObservationsPanel, {
        observations,
        sevLabel,
        sevClass,
        datasetLabel,
        onToggleApprove: toggleApprove,
        onDelete: (id) => {
          const n = new Set(deletedObs).add(id);
          saveIds("deleted", n);
          setDeletedObs(n);
        },
        deletedCount,
        onRestore: () => {
          saveIds("deleted", new Set());
          setDeletedObs(new Set());
        },
        decisions: obsDecisions,
        onDecide: decideObservation,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegalCoveragePanel, {
        observations,
        docs,
        links: legalLinks,
        datasetLabel,
        onLink: (key, link) => {
          const n = { ...legalLinks, [key]: link };
          saveLinks(n);
          setLegalLinks(n);
        },
        onUnlink: (key) => {
          const n = { ...legalLinks };
          delete n[key];
          saveLinks(n);
          setLegalLinks(n);
        },
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewStatsPanel, {
        log: reviewLog,
        threshold: reviewThreshold,
        onThresholdChange: (t) => {
          saveThreshold(t);
          setReviewThreshold(t);
        },
        datasetLabel,
      }),
    
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalibrationPanel, {
        calibration,
        setCalibration,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExecutiveDashboard, {
        store,
        findings,
        sectors: auditSectors,
        resolved,
        historyStats,
        sectorLabel,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdvancedPanel, {
        observations,
        Button,
        store: sectorStore,
        findings: sectorFindings,
        reports,
        ds,
        sector,
        sectors: [sector],
        sevLabel,
        sevClass,
        datasetLabel,
      }),
        ],
      }),
    ],
  });
}
var radar_sculpture_jpg_asset_default = {
  version: 1,
  asset_id: "b918e521-358b-47bd-9b0d-146c0a2b295d",
  project_id: "80777303-2476-45ed-a65c-fa5aea950476",
  url: "/__l5e/assets-v1/b918e521-358b-47bd-9b0d-146c0a2b295d/radar-sculpture.jpg",
  r2_key:
    "a/v1/80777303-2476-45ed-a65c-fa5aea950476/b918e521-358b-47bd-9b0d-146c0a2b295d/radar-sculpture.jpg",
  original_filename: "radar-sculpture.jpg",
  size: 83100,
  content_type: "image/jpeg",
  created_at: "2026-10-16T00:05:52Z",
};
var nav = [
  {
    id: "overview",
    key: "overview",
    icon: LayoutGrid,
  },
  {
    id: "reports",
    key: "reports",
    icon: FileChartColumn,
  },
];
var auditNav = [
  { id: "audit", label: "تدقيق الأنشطة والعمليات", icon: ShieldCheck, tab: "audit" },
  { id: "rules", label: "الأنظمة والتعليمات", icon: BookOpen, tab: "rules" },
  { id: "pastreports", label: "التقارير السابقة", icon: History, tab: "reports" },
];
function Workspace() {
  const [view, setView] = (0, import_react.useState)("overview");
  const [entries, setEntries] = (0, import_react.useState)([]);
  const [sectors, setSectors] = (0, import_react.useState)([]);
  const [language, setLanguage] = (0, import_react.useState)("ar");
  const [night, setNight] = (0, import_react.useState)(false);
  const [motion, setMotion] = (0, import_react.useState)(true);
  const [compact, setCompact] = (0, import_react.useState)(false);
  const [ready, setReady] = (0, import_react.useState)(false);
  const [rules, setRules] = (0, import_react.useState)({
    limits: true,
    duplicates: true,
    outliers: false,
    sensitivity: "",
  });
  const [expected, setExpected] = (0, import_react.useState)("");
  const [sector, setSector] = (0, import_react.useState)("all");
  const [period, setPeriod] = (0, import_react.useState)("anytime");
  const [search, setSearch] = (0, import_react.useState)("");
  const [dialog, setDialog] = (0, import_react.useState)(null);
  const [detail, setDetail] = (0, import_react.useState)(null);
  const [reviewed, setReviewed] = (0, import_react.useState)([]);
  const [notice, setNotice] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const t = translator(language);
  const dir = isRtl(language) ? "rtl" : "ltr";
  const number = (n) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(n);
  const name = (key) => sectors.find((s) => s.key === key)?.name ?? key;
  (0, import_react.useEffect)(() => {
    try {
      const p = JSON.parse(localStorage.getItem("rasd-preferences") ?? "null");
      if (p) {
        if (languages.some((l) => l[0] === p.language)) setLanguage(p.language);
        setNight(p.night === true);
        setMotion(p.motion !== false);
        setCompact(p.compact === true);
      }
    } catch {}
    if (seedDemoFromUrl()) setView("audit");
    setReady(true);
  }, []);
  (0, import_react.useEffect)(() => {
    document.documentElement.classList.toggle("dark", night);
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
    document.documentElement.dataset["motion"] = String(motion);
    if (ready)
      localStorage.setItem(
        "rasd-preferences",
        JSON.stringify({
          language,
          night,
          motion,
          compact,
        }),
      );
  }, [language, night, motion, compact, ready, dir]);
  const findings = (0, import_react.useMemo)(
    () => analyzeEntries(entries, rules),
    [entries, rules],
  );
  const week = /* @__PURE__ */ new Date();
  week.setDate(week.getDate() - 7);
  const filtered = entries.filter(
    (e) =>
      (sector === "all" || e.sector === sector) &&
      (period !== "week" || new Date(e.date) >= week) &&
      `${e.label} ${name(e.sector)}`
        .toLocaleLowerCase(language)
        .includes(search.toLocaleLowerCase(language)),
  );
  const shown = findings.filter((f) =>
    filtered.some((e) => e.id === f.entry.id),
  );
  const open = shown.filter((f) => !reviewed.includes(f.id));
  const affected = new Set(shown.map((f) => f.entry.id));
  const health = filtered.length
    ? number(((filtered.length - affected.size) / filtered.length) * 100) + "%"
    : "—";
  // يشارك المساعد الذكي ملخصًا مضغوطًا لما يعرضه التطبيق الآن
  (0, import_react.useEffect)(() => {
    if (!entries.length) return publishAssistantContext("entries", null);
    publishAssistantContext("entries", {
      view,
      entriesTotal: entries.length,
      entriesShown: filtered.length,
      sectorFilter: sector === "all" ? "الكل" : name(sector),
      health,
      openFindings: open.length,
      reviewedFindings: reviewed.length,
      rules,
      sampleOpenFindings: open.slice(0, 25).map((f) => ({
        kind: f.kind,
        severity: f.severity,
        sector: name(f.entry.sector),
        label: f.entry.label,
        value: f.entry.value,
        limit: f.entry.limit,
        date: f.entry.date,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, entries, sector, search, period, rules, reviewed, sectors]);
  const chart = [...new Set(filtered.map((e) => e.date))].sort().map((date) => {
    const rows = filtered.filter((e) => e.date === date);
    return {
      date,
      actual: rows.reduce((sum, e) => sum + e.value, 0),
      expected:
        expected === ""
          ? void 0
          : rows.reduce(
              (sum, e) => sum + (e.limit * Number(expected)) / 100,
              0,
            ),
    };
  });
  function openDialog(d) {
    setError("");
    setDialog(d);
  }
  function download(filename, rows, fields) {
    const csv = fields
      ? import_papaparse.default.unparse({
          fields,
          data: [],
        })
      : import_papaparse.default.unparse(rows);
    const url = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(t("done"));
  }
  function exportEntries() {
    download(
      "rasd-entries.csv",
      filtered.map((e) => ({
        label: e.label,
        value: e.value,
        limit: e.limit,
        sector: name(e.sector),
        date: e.date,
      })),
    );
  }
  function exportReport() {
    download(
      "rasd-report.csv",
      shown.map((f) => ({
        [t("sectors")]: name(f.entry.sector),
        [t("description")]: f.entry.label,
        [t("value")]: f.entry.value,
        [t("limit")]: f.entry.limit,
        [t("alerts")]: findingTitle(f),
        [t("status")]: t(reviewed.includes(f.id) ? "reviewed" : "attention"),
      })),
    );
  }
  function findingTitle(f) {
    return t(
      f.kind === "limit"
        ? "limitFinding"
        : f.kind === "outlier"
          ? "outlierFinding"
          : "duplicateFinding",
    );
  }
  function Empty() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
      className: "empty-state",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileSpreadsheet, {
          size: 32,
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          children: t("empty"),
        }),
      ],
    });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: `workspace ${compact ? "compact" : ""}`,
    "data-motion": motion,
    dir,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
        className: "side-panel",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "wordmark",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                className: "brand-symbol",
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radar, {
                  size: 27,
                }),
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
                children: [
                  t("brand"),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    className: "text-primary",
                    children: ".",
                  }),
                ],
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "side-caption",
            children: t("tagline"),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "nav-label",
            children: t("workspace"),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
            "aria-label": t("workspace"),
            children: nav.map((n) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "span",
                {
                  className: "contents",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                      variant: "ghost",
                      className: "nav-item",
                      "data-active": view === n.id,
                      title: t(n.key),
                      onClick: () => setView(n.id),
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(n.icon, {
                          size: 18,
                        }),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                          className: "nav-text",
                          children: t(n.key),
                        }),
                      ],
                    }),
                    n.id === "overview" &&
                      auditNav.map((a) =>
                        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                          Button,
                          {
                            variant: "ghost",
                            className: "nav-item",
                            "data-active": view === a.id,
                            title: a.label,
                            onClick: () => setView(a.id),
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(a.icon, { size: 18 }),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                                className: "nav-text",
                                children: a.label,
                              }),
                            ],
                          },
                          a.id,
                        ),
                      ),
                  ],
                },
                n.id,
              ),
            ),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "side-bottom",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                variant: "ghost",
                className: "nav-item",
                title: t("settings"),
                onClick: () => openDialog("settings"),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings2, {}),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    className: "nav-text",
                    children: t("settings"),
                  }),
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                variant: "ghost",
                className: "nav-item",
                title: t("help"),
                onClick: () => openDialog("help"),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    CircleQuestionMark,
                    {},
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    className: "nav-text",
                    children: t("help"),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
        className: "main-panel",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
            className: "topbar",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                className: "flex items-center gap-2 text-xs",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radar, {
                    size: 18,
                    className: "text-muted-foreground",
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    children:
                      auditNav.find((a) => a.id === view)
                        ? auditNav.find((a) => a.id === view).label
                        : t(nav.find((n) => n.id === view)?.key ?? "overview"),
                  }),
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                className: "header-actions",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
                    className: "search-box flex items-center gap-2",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
                        size: 15,
                      }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                        "aria-label": t("search"),
                        placeholder: t("search"),
                        className: "w-36 bg-transparent text-xs outline-none",
                        value: search,
                        onChange: (e) => setSearch(e.target.value),
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, {
                    size: 16,
                    className: "hidden sm:block text-muted-foreground",
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
                    "aria-label": t("language"),
                    className: "field-input min-h-8 w-auto py-1 text-xs",
                    value: language,
                    onChange: (e) => setLanguage(e.target.value),
                    children: languages.map(([key, label]) =>
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "option",
                        {
                          value: key,
                          children: label,
                        },
                        key,
                      ),
                    ),
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                    variant: "ghost",
                    size: "icon",
                    title: t("night"),
                    "aria-label": t("night"),
                    "aria-pressed": night,
                    onClick: () => setNight((p) => !p),
                    children: night
                      ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, {})
                      : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, {}),
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                    variant: "ghost",
                    size: "icon",
                    title: t("settings"),
                    "aria-label": t("settings"),
                    onClick: () => openDialog("settings"),
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      Settings2,
                      {},
                    ),
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                    variant: "ghost",
                    size: "icon",
                    "aria-label": t("alerts"),
                    title: t("alerts"),
                    onClick: () => setView("reports"),
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      Bell,
                      {},
                    ),
                  }),
                ],
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              className: "content",
              children: [
                auditNav.some((a) => a.id === view)
                  ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectorAudit, {
                      auditTab: auditNav.find((a) => a.id === view).tab,
                    })
                  : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      import_jsx_runtime.Fragment,
                      {
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                            className: "view-heading",
                            children: /* @__PURE__ */ (0,
                            import_jsx_runtime.jsxs)("div", {
                              children: [
                                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                  "h1",
                                  {
                                    children: t(
                                      view === "overview"
                                        ? "headline"
                                        : (nav.find((n) => n.id === view)
                                            ?.key ?? "overview"),
                                    ),
                                  },
                                ),
                                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                  "p",
                                  {
                                    className:
                                      "mt-2 text-xs text-muted-foreground",
                                    children: t("tagline"),
                                  },
                                ),
                              ],
                            }),
                          }),
                          view === "overview" &&
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                              "section",
                              {
                                className: "intro-banner",
                                children: [
                                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                    "img",
                                    {
                                      src: radarImg,
                                      alt: t("brand"),
                                      className: "intro-image",
                                    },
                                  ),
                                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                                    "div",
                                    {
                                      className: "intro-copy",
                                      children: [
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsxs)("div", {
                                          className: "eyebrow",
                                          children: [
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)("span", {
                                              className: "live-dot",
                                            }),
                                            t("brand"),
                                          ],
                                        }),
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsx)("h2", {
                                          children: t("intro"),
                                        }),
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsx)("p", {
                                          children: t("tagline"),
                                        }),
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsxs)(Button, {
                                          variant: "ink",
                                          disabled: !entries.length || busy,
                                          onClick: () => {
                                            setBusy(true);
                                            window.setTimeout(() => {
                                              setBusy(false);
                                              setNotice(
                                                `${t("analysisDone")} · ${number(shown.length)} ${t("alerts")}`,
                                              );
                                            }, 450);
                                          },
                                          children: [
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)(Radar, {
                                              className: busy
                                                ? "animate-spin"
                                                : "",
                                            }),
                                            t("run"),
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)(
                                              ArrowLeft,
                                              {},
                                            ),
                                          ],
                                        }),
                                      ],
                                    },
                                  ),
                                ],
                              },
                            ),
                          notice &&
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                              "div",
                              {
                                role: "status",
                                className:
                                  "mb-4 flex items-center gap-2 rounded-md bg-success-soft px-4 py-3 text-xs text-success",
                                children: [
                                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                    Check,
                                    {},
                                  ),
                                  notice,
                                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                    Button,
                                    {
                                      variant: "ghost",
                                      size: "icon",
                                      "aria-label": t("close"),
                                      className: "ms-auto size-6",
                                      onClick: () => setNotice(""),
                                      children: /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)(X, {}),
                                    },
                                  ),
                                ],
                              },
                            ),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                            className:
                              "flex flex-wrap justify-between items-center gap-3",
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "h2",
                                {
                                  className: "text-sm font-semibold",
                                  children: t("summary"),
                                },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                                "div",
                                {
                                  className: "header-actions",
                                  children: [
                                    /* @__PURE__ */ (0,
                                    import_jsx_runtime.jsxs)("select", {
                                      className:
                                        "field-input min-h-8 w-auto py-1 text-xs",
                                      "aria-label": t("sectors"),
                                      value: sector,
                                      onChange: (e) =>
                                        setSector(e.target.value),
                                      children: [
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsx)("option", {
                                          value: "all",
                                          children: t("all"),
                                        }),
                                        sectors.map((s) =>
                                          /* @__PURE__ */ (0,
                                          import_jsx_runtime.jsx)(
                                            "option",
                                            {
                                              value: s.key,
                                              children: s.name,
                                            },
                                            s.key,
                                          ),
                                        ),
                                      ],
                                    }),
                                    /* @__PURE__ */ (0,
                                    import_jsx_runtime.jsxs)("select", {
                                      className:
                                        "field-input min-h-8 w-auto py-1 text-xs",
                                      "aria-label": t("date"),
                                      value: period,
                                      onChange: (e) =>
                                        setPeriod(e.target.value),
                                      children: [
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsx)("option", {
                                          value: "anytime",
                                          children: t("anytime"),
                                        }),
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsx)("option", {
                                          value: "week",
                                          children: t("week"),
                                        }),
                                      ],
                                    }),
                                  ],
                                },
                              ),
                            ],
                          }),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                            "section",
                            {
                              className: "stats-grid",
                              children: [
                                {
                                  key: "records",
                                  value: number(filtered.length),
                                  icon: FileSpreadsheet,
                                },
                                {
                                  key: "alerts",
                                  value: number(shown.length),
                                  icon: Activity,
                                },
                                {
                                  key: "active",
                                  value: number(
                                    new Set(filtered.map((e) => e.sector)).size,
                                  ),
                                  icon: Building2,
                                },
                                {
                                  key: "health",
                                  value: health,
                                  icon: ShieldCheck,
                                },
                              ].map((s) =>
                                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                                  "div",
                                  {
                                    className: "stat-card",
                                    children: [
                                      /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsxs)("div", {
                                        className:
                                          "flex items-center justify-between gap-2",
                                        children: [
                                          /* @__PURE__ */ (0,
                                          import_jsx_runtime.jsx)("span", {
                                            className:
                                              "text-xs text-muted-foreground",
                                            children: t(s.key),
                                          }),
                                          /* @__PURE__ */ (0,
                                          import_jsx_runtime.jsx)(s.icon, {
                                            size: 18,
                                            className:
                                              s.key === "alerts"
                                                ? "text-danger"
                                                : s.key === "health"
                                                  ? "text-success"
                                                  : "text-muted-foreground",
                                          }),
                                        ],
                                      }),
                                      /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)("div", {
                                        className: "stat-value",
                                        dir: "ltr",
                                        children: s.value,
                                      }),
                                    ],
                                  },
                                  s.key,
                                ),
                              ),
                            },
                          ),
                          view === "overview" &&
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                              "section",
                              {
                                className: "analysis-grid",
                                children: [
                                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                                    "div",
                                    {
                                      className: "chart-panel",
                                      children: [
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsxs)("div", {
                                          className: "panel-heading",
                                          children: [
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)("h3", {
                                              children: t("trends"),
                                            }),
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsxs)("span", {
                                              className:
                                                "text-xs text-muted-foreground",
                                              children: [
                                                t("actual"),
                                                expected !== "" &&
                                                  ` / ${t("target")}`,
                                              ],
                                            }),
                                          ],
                                        }),
                                        !chart.length
                                          ? /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)(Empty, {})
                                          : /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)("div", {
                                              className: "chart-wrap",
                                              children: /* @__PURE__ */ (0,
                                              import_jsx_runtime.jsx)(
                                                ResponsiveContainer,
                                                {
                                                  width: "100%",
                                                  height: "100%",
                                                  children: /* @__PURE__ */ (0,
                                                  import_jsx_runtime.jsxs)(
                                                    ComposedChart,
                                                    {
                                                      data: chart,
                                                      children: [
                                                        /* @__PURE__ */ (0,
                                                        import_jsx_runtime.jsx)(
                                                          CartesianGrid,
                                                          {
                                                            stroke:
                                                              "var(--border)",
                                                            vertical: false,
                                                          },
                                                        ),
                                                        /* @__PURE__ */ (0,
                                                        import_jsx_runtime.jsx)(
                                                          XAxis,
                                                          {
                                                            dataKey: "date",
                                                            tick: {
                                                              fontSize: 10,
                                                              fill: "var(--muted-foreground)",
                                                            },
                                                          },
                                                        ),
                                                        /* @__PURE__ */ (0,
                                                        import_jsx_runtime.jsx)(
                                                          YAxis,
                                                          {
                                                            tick: {
                                                              fontSize: 10,
                                                              fill: "var(--muted-foreground)",
                                                            },
                                                          },
                                                        ),
                                                        /* @__PURE__ */ (0,
                                                        import_jsx_runtime.jsx)(
                                                          Tooltip,
                                                          {
                                                            contentStyle: {
                                                              background:
                                                                "var(--card)",
                                                              color:
                                                                "var(--foreground)",
                                                              border:
                                                                "1px solid var(--border)",
                                                            },
                                                            formatter: (
                                                              v,
                                                              key,
                                                            ) => [
                                                              number(v),
                                                              t(
                                                                key === "actual"
                                                                  ? "actual"
                                                                  : "target",
                                                              ),
                                                            ],
                                                          },
                                                        ),
                                                        /* @__PURE__ */ (0,
                                                        import_jsx_runtime.jsx)(
                                                          Line,
                                                          {
                                                            dataKey: "actual",
                                                            stroke:
                                                              "var(--ink)",
                                                            strokeWidth: 2,
                                                            dot: false,
                                                          },
                                                        ),
                                                        expected !== "" &&
                                                          /* @__PURE__ */ (0,
                                                          import_jsx_runtime.jsx)(
                                                            Area,
                                                            {
                                                              dataKey:
                                                                "expected",
                                                              stroke:
                                                                "var(--primary)",
                                                              fill: "var(--primary)",
                                                              fillOpacity: 0.15,
                                                            },
                                                          ),
                                                      ],
                                                    },
                                                  ),
                                                },
                                              ),
                                            }),
                                      ],
                                    },
                                  ),
                                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                                    "div",
                                    {
                                      className: "alert-panel",
                                      children: [
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsxs)("div", {
                                          className: "panel-heading",
                                          children: [
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)("h3", {
                                              children: t("attention"),
                                            }),
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)("span", {
                                              className: "text-danger",
                                              children: number(open.length),
                                            }),
                                          ],
                                        }),
                                        open.length
                                          ? open.slice(0, 3).map((f) =>
                                              /* @__PURE__ */ (0,
                                              import_jsx_runtime.jsxs)(
                                                "div",
                                                {
                                                  className: "alert-item",
                                                  children: [
                                                    /* @__PURE__ */ (0,
                                                    import_jsx_runtime.jsx)(
                                                      Activity,
                                                      {
                                                        size: 18,
                                                        className:
                                                          "text-danger",
                                                      },
                                                    ),
                                                    /* @__PURE__ */ (0,
                                                    import_jsx_runtime.jsxs)(
                                                      "div",
                                                      {
                                                        children: [
                                                          /* @__PURE__ */ (0,
                                                          import_jsx_runtime.jsx)(
                                                            Button,
                                                            {
                                                              variant: "link",
                                                              className:
                                                                "p-0 h-auto text-foreground whitespace-normal text-start",
                                                              onClick: () =>
                                                                setDetail(f),
                                                              children:
                                                                findingTitle(f),
                                                            },
                                                          ),
                                                          /* @__PURE__ */ (0,
                                                          import_jsx_runtime.jsx)(
                                                            "p",
                                                            {
                                                              className:
                                                                "text-xs text-muted-foreground mt-1",
                                                              children:
                                                                f.entry.label,
                                                            },
                                                          ),
                                                        ],
                                                      },
                                                    ),
                                                  ],
                                                },
                                                f.id,
                                              ),
                                            )
                                          : /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsxs)("div", {
                                              className: "empty-state",
                                              children: [
                                                /* @__PURE__ */ (0,
                                                import_jsx_runtime.jsx)(
                                                  ShieldCheck,
                                                  { size: 30 },
                                                ),
                                                t(
                                                  entries.length
                                                    ? "noResults"
                                                    : "empty",
                                                ),
                                              ],
                                            }),
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsxs)(Button, {
                                          variant: "ghost",
                                          className:
                                            "w-full border-t border-border rounded-none",
                                          onClick: () => setView("reports"),
                                          children: [
                                            t("alerts"),
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)(
                                              ArrowLeft,
                                              {},
                                            ),
                                          ],
                                        }),
                                      ],
                                    },
                                  ),
                                ],
                              },
                            ),
                          (view === "overview" || view === "sectors") &&
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                              "section",
                              {
                                className: "table-panel",
                                children: [
                                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                    "div",
                                    {
                                      className: "panel-heading",
                                      children: /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)("h3", {
                                        children: t("sectors"),
                                      }),
                                    },
                                  ),
                                  !sectors.length
                                    ? /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)(Empty, {})
                                    : /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)("div", {
                                        className: "table-scroll",
                                        children: /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsxs)("table", {
                                          className: "data-table",
                                          children: [
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)("thead", {
                                              children: /* @__PURE__ */ (0,
                                              import_jsx_runtime.jsx)("tr", {
                                                children: [
                                                  "name",
                                                  "records",
                                                  "alerts",
                                                  "health",
                                                  "delete",
                                                ].map((k) =>
                                                  /* @__PURE__ */ (0,
                                                  import_jsx_runtime.jsx)(
                                                    "th",
                                                    { children: t(k) },
                                                    k,
                                                  ),
                                                ),
                                              }),
                                            }),
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)("tbody", {
                                              children: sectors
                                                .filter(
                                                  (s) =>
                                                    sector === "all" ||
                                                    sector === s.key,
                                                )
                                                .map((s) => {
                                                  const rows = filtered.filter(
                                                    (e) => e.sector === s.key,
                                                  );
                                                  const fs = shown.filter(
                                                    (f) =>
                                                      f.entry.sector === s.key,
                                                  );
                                                  return /* @__PURE__ */ (0,
                                                  import_jsx_runtime.jsxs)(
                                                    "tr",
                                                    {
                                                      children: [
                                                        /* @__PURE__ */ (0,
                                                        import_jsx_runtime.jsx)(
                                                          "td",
                                                          {
                                                            children:
                                                              /* @__PURE__ */ (0,
                                                              import_jsx_runtime.jsx)(
                                                                Button,
                                                                {
                                                                  variant:
                                                                    "link",
                                                                  className:
                                                                    "text-foreground h-auto p-0",
                                                                  onClick:
                                                                    () => {
                                                                      setSector(
                                                                        s.key,
                                                                      );
                                                                      setView(
                                                                        "overview",
                                                                      );
                                                                    },
                                                                  children:
                                                                    s.name,
                                                                },
                                                              ),
                                                          },
                                                        ),
                                                        /* @__PURE__ */ (0,
                                                        import_jsx_runtime.jsx)(
                                                          "td",
                                                          {
                                                            children: number(
                                                              rows.length,
                                                            ),
                                                          },
                                                        ),
                                                        /* @__PURE__ */ (0,
                                                        import_jsx_runtime.jsx)(
                                                          "td",
                                                          {
                                                            className:
                                                              "text-danger",
                                                            children: number(
                                                              fs.length,
                                                            ),
                                                          },
                                                        ),
                                                        /* @__PURE__ */ (0,
                                                        import_jsx_runtime.jsx)(
                                                          "td",
                                                          {
                                                            children:
                                                              rows.length
                                                                ? number(
                                                                    ((rows.length -
                                                                      new Set(
                                                                        fs.map(
                                                                          (f) =>
                                                                            f
                                                                              .entry
                                                                              .id,
                                                                        ),
                                                                      ).size) /
                                                                      rows.length) *
                                                                      100,
                                                                  ) + "%"
                                                                : "—",
                                                          },
                                                        ),
                                                        /* @__PURE__ */ (0,
                                                        import_jsx_runtime.jsx)(
                                                          "td",
                                                          {
                                                            children:
                                                              /* @__PURE__ */ (0,
                                                              import_jsx_runtime.jsx)(
                                                                Button,
                                                                {
                                                                  variant:
                                                                    "ghost",
                                                                  size: "icon",
                                                                  "aria-label": `${t("delete")} ${s.name}`,
                                                                  disabled:
                                                                    entries.some(
                                                                      (e) =>
                                                                        e.sector ===
                                                                        s.key,
                                                                    ),
                                                                  onClick:
                                                                    () => {
                                                                      setSectors(
                                                                        (p) =>
                                                                          p.filter(
                                                                            (
                                                                              x,
                                                                            ) =>
                                                                              x.key !==
                                                                              s.key,
                                                                          ),
                                                                      );
                                                                      if (
                                                                        sector ===
                                                                        s.key
                                                                      )
                                                                        setSector(
                                                                          "all",
                                                                        );
                                                                    },
                                                                  children:
                                                                    /* @__PURE__ */ (0,
                                                                    import_jsx_runtime.jsx)(
                                                                      Trash2,
                                                                      {},
                                                                    ),
                                                                },
                                                              ),
                                                          },
                                                        ),
                                                      ],
                                                    },
                                                    s.key,
                                                  );
                                                }),
                                            }),
                                          ],
                                        }),
                                      }),
                                ],
                              },
                            ),
                          view === "data" &&
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                              "section",
                              {
                                className: "table-panel",
                                children: [
                                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                                    "div",
                                    {
                                      className: "panel-heading",
                                      children: [
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsx)("h3", {
                                          children: t("data"),
                                        }),
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsxs)(Button, {
                                          variant: "outline",
                                          disabled: !filtered.length,
                                          onClick: exportEntries,
                                          children: [
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)(
                                              Download,
                                              {},
                                            ),
                                            t("export"),
                                          ],
                                        }),
                                      ],
                                    },
                                  ),
                                  !filtered.length
                                    ? /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)(Empty, {})
                                    : /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)("div", {
                                        className: "table-scroll",
                                        children: /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsxs)("table", {
                                          className: "data-table",
                                          children: [
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)("thead", {
                                              children: /* @__PURE__ */ (0,
                                              import_jsx_runtime.jsx)("tr", {
                                                children: [
                                                  "description",
                                                  "sectors",
                                                  "value",
                                                  "limit",
                                                  "date",
                                                  "status",
                                                  "delete",
                                                ].map((k) =>
                                                  /* @__PURE__ */ (0,
                                                  import_jsx_runtime.jsx)(
                                                    "th",
                                                    { children: t(k) },
                                                    k,
                                                  ),
                                                ),
                                              }),
                                            }),
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)("tbody", {
                                              children: filtered.map((e) =>
                                                /* @__PURE__ */ (0,
                                                import_jsx_runtime.jsxs)(
                                                  "tr",
                                                  {
                                                    children: [
                                                      /* @__PURE__ */ (0,
                                                      import_jsx_runtime.jsx)(
                                                        "td",
                                                        { children: e.label },
                                                      ),
                                                      /* @__PURE__ */ (0,
                                                      import_jsx_runtime.jsx)(
                                                        "td",
                                                        {
                                                          children: name(
                                                            e.sector,
                                                          ),
                                                        },
                                                      ),
                                                      /* @__PURE__ */ (0,
                                                      import_jsx_runtime.jsx)(
                                                        "td",
                                                        {
                                                          children: number(
                                                            e.value,
                                                          ),
                                                        },
                                                      ),
                                                      /* @__PURE__ */ (0,
                                                      import_jsx_runtime.jsx)(
                                                        "td",
                                                        {
                                                          children: number(
                                                            e.limit,
                                                          ),
                                                        },
                                                      ),
                                                      /* @__PURE__ */ (0,
                                                      import_jsx_runtime.jsx)(
                                                        "td",
                                                        {
                                                          dir: "ltr",
                                                          children: e.date,
                                                        },
                                                      ),
                                                      /* @__PURE__ */ (0,
                                                      import_jsx_runtime.jsx)(
                                                        "td",
                                                        {
                                                          children:
                                                            /* @__PURE__ */ (0,
                                                            import_jsx_runtime.jsx)(
                                                              "span",
                                                              {
                                                                className: `status-badge ${affected.has(e.id) ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`,
                                                                children: t(
                                                                  affected.has(
                                                                    e.id,
                                                                  )
                                                                    ? "attention"
                                                                    : "normal",
                                                                ),
                                                              },
                                                            ),
                                                        },
                                                      ),
                                                      /* @__PURE__ */ (0,
                                                      import_jsx_runtime.jsx)(
                                                        "td",
                                                        {
                                                          children:
                                                            /* @__PURE__ */ (0,
                                                            import_jsx_runtime.jsx)(
                                                              Button,
                                                              {
                                                                variant:
                                                                  "ghost",
                                                                size: "icon",
                                                                "aria-label": `${t("delete")} ${e.label}`,
                                                                onClick: () => {
                                                                  setEntries(
                                                                    (p) =>
                                                                      p.filter(
                                                                        (r) =>
                                                                          r.id !==
                                                                          e.id,
                                                                      ),
                                                                  );
                                                                  setReviewed(
                                                                    (p) =>
                                                                      p.filter(
                                                                        (id) =>
                                                                          !id.startsWith(
                                                                            e.id,
                                                                          ),
                                                                      ),
                                                                  );
                                                                },
                                                                children:
                                                                  /* @__PURE__ */ (0,
                                                                  import_jsx_runtime.jsx)(
                                                                    Trash2,
                                                                    {},
                                                                  ),
                                                              },
                                                            ),
                                                        },
                                                      ),
                                                    ],
                                                  },
                                                  e.id,
                                                ),
                                              ),
                                            }),
                                          ],
                                        }),
                                      }),
                                ],
                              },
                            ),
                          view === "reports" &&
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuditReport, {
                              Button,
                              sevLabel,
                              sevClass,
                              datasetLabel,
                              loadSaved: loadReports,
                              onExportPdf: (r) => downloadReportPdf(r, datasetLabel),
                            }),
                          view === "reports" &&
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                              "section",
                              {
                                className: "table-panel",
                                children: [
                                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                                    "div",
                                    {
                                      className: "panel-heading",
                                      children: [
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsx)("h3", {
                                          children: t("report"),
                                        }),
                                        /* @__PURE__ */ (0,
                                        import_jsx_runtime.jsxs)(Button, {
                                          variant: "ink",
                                          disabled: !filtered.length,
                                          onClick: exportReport,
                                          children: [
                                            /* @__PURE__ */ (0,
                                            import_jsx_runtime.jsx)(
                                              Download,
                                              {},
                                            ),
                                            t("export"),
                                          ],
                                        }),
                                      ],
                                    },
                                  ),
                                  !filtered.length
                                    ? /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsx)(Empty, {})
                                    : /* @__PURE__ */ (0,
                                      import_jsx_runtime.jsxs)("div", {
                                        className: "p-6",
                                        children: [
                                          /* @__PURE__ */ (0,
                                          import_jsx_runtime.jsx)("dl", {
                                            className: "space-y-4 text-sm",
                                            children: [
                                              "limit",
                                              "outlier",
                                              "duplicate",
                                            ].map((kind) =>
                                              /* @__PURE__ */ (0,
                                              import_jsx_runtime.jsxs)(
                                                "div",
                                                {
                                                  className:
                                                    "flex justify-between border-b border-border pb-3",
                                                  children: [
                                                    /* @__PURE__ */ (0,
                                                    import_jsx_runtime.jsx)(
                                                      "dt",
                                                      {
                                                        children: t(
                                                          kind === "limit"
                                                            ? "limitFinding"
                                                            : kind === "outlier"
                                                              ? "outlierFinding"
                                                              : "duplicateFinding",
                                                        ),
                                                      },
                                                    ),
                                                    /* @__PURE__ */ (0,
                                                    import_jsx_runtime.jsx)(
                                                      "dd",
                                                      {
                                                        children: number(
                                                          shown.filter(
                                                            (f) =>
                                                              f.kind === kind,
                                                          ).length,
                                                        ),
                                                      },
                                                    ),
                                                  ],
                                                },
                                                kind,
                                              ),
                                            ),
                                          }),
                                          /* @__PURE__ */ (0,
                                          import_jsx_runtime.jsx)("p", {
                                            className:
                                              "mt-6 text-xs text-muted-foreground",
                                            children: t("disclaimer"),
                                          }),
                                        ],
                                      }),
                                ],
                              },
                            ),
                        ],
                      },
                    ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
                  className: "page-footer",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
                      children: [t("brand"), " · ", t("tagline")],
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
                      className: "flex items-center gap-2",
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          ShieldCheck,
                          { size: 13 },
                        ),
                        t("session"),
                      ],
                    }),
                  ],
                }),
              ],
            },
            view,
          ),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
        open: dialog !== null,
        onOpenChange: (o) => {
          if (!o) setDialog(null);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
          dir,
          className: "max-h-[90vh] overflow-y-auto max-w-lg",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
              className: "text-start pe-7",
              children: t(
                dialog === "settings"
                  ? "settings"
                  : dialog === "reset"
                    ? "reset"
                    : "help",
              ),
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
              className: "text-start text-xs",
              children: t(
                dialog === "help"
                  ? "helpText"
                  : dialog === "reset"
                    ? "confirmReset"
                    : "workspace",
              ),
            }),
            dialog === "settings" &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
                    className: "settings-section-title",
                    children: t("appearance"),
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                    className: "settings-row",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
                        htmlFor: "language-settings",
                        children: t("language"),
                      }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
                        id: "language-settings",
                        className: "field-input",
                        value: language,
                        onChange: (e) => setLanguage(e.target.value),
                        children: languages.map(([k, l]) =>
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                            "option",
                            {
                              value: k,
                              children: l,
                            },
                            k,
                          ),
                        ),
                      }),
                    ],
                  }),
                  [
                    {
                      key: "night",
                      value: night,
                      set: setNight,
                    },
                    {
                      key: "motion",
                      value: motion,
                      set: setMotion,
                    },
                    {
                      key: "compact",
                      value: compact,
                      set: setCompact,
                    },
                  ].map((s) =>
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      "div",
                      {
                        className: "settings-row",
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
                            htmlFor: s.key,
                            children: t(s.key),
                          }),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
                            dir,
                            id: s.key,
                            checked: s.value,
                            onCheckedChange: s.set,
                          }),
                        ],
                      },
                      s.key,
                    ),
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
                    className: "settings-section-title",
                    children: t("rules"),
                  }),
                  [
                    {
                      key: "limits",
                      text: "checkLimits",
                    },
                    {
                      key: "duplicates",
                      text: "checkDuplicates",
                    },
                    {
                      key: "outliers",
                      text: "outliers",
                    },
                  ].map((r) =>
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      "div",
                      {
                        className: "settings-row",
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
                            htmlFor: r.key,
                            children: t(r.text),
                          }),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
                            id: r.key,
                            dir,
                            checked: rules[r.key],
                            onCheckedChange: (v) =>
                              setRules({
                                ...rules,
                                [r.key]: v,
                              }),
                          }),
                        ],
                      },
                      r.key,
                    ),
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
                    className: "form-field mt-4",
                    children: [
                      t("sensitivity"),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                        className: "field-input",
                        type: "number",
                        min: "0.01",
                        step: "any",
                        value: rules.sensitivity,
                        onChange: (e) => {
                          if (
                            e.target.value === "" ||
                            Number(e.target.value) > 0
                          )
                            setRules({
                              ...rules,
                              sensitivity: e.target.value,
                            });
                        },
                      }),
                    ],
                  }),
                  rules.outliers &&
                    !rules.sensitivity &&
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                      className: "inline-error mt-2",
                      children: t("missingThreshold"),
                    }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
                    className: "form-field mt-4",
                    children: [
                      t("expected"),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
                        type: "number",
                        min: "0",
                        max: "100",
                        step: "any",
                        className: "field-input",
                        value: expected,
                        onChange: (e) => {
                          if (
                            e.target.value === "" ||
                            (Number(e.target.value) >= 0 &&
                              Number(e.target.value) <= 100)
                          )
                            setExpected(e.target.value);
                        },
                      }),
                    ],
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                    className: "mt-6 flex flex-wrap justify-between gap-3",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                        variant: "destructive",
                        disabled: !entries.length && !sectors.length,
                        onClick: () => openDialog("reset"),
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                            Trash2,
                            {},
                          ),
                          t("reset"),
                        ],
                      }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                        variant: "ink",
                        onClick: () => {
                          setDialog(null);
                          setNotice(t("settingsSaved"));
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                            Check,
                            {},
                          ),
                          t("save"),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            dialog === "reset" &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
                className: "flex justify-end gap-3",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                    variant: "outline",
                    onClick: () => openDialog("settings"),
                    children: t("cancel"),
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                    variant: "destructive",
                    onClick: () => {
                      setEntries([]);
                      setSectors([]);
                      setReviewed([]);
                      setSector("all");
                      setSearch("");
                      setExpected("");
                      setRules({
                        limits: true,
                        duplicates: true,
                        outliers: false,
                        sensitivity: "",
                      });
                      setDialog(null);
                      setNotice(t("done"));
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {}),
                      t("clear"),
                    ],
                  }),
                ],
              }),
            error &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                className: "inline-error",
                role: "alert",
                children: error,
              }),
          ],
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
        open: detail !== null,
        onOpenChange: (o) => {
          if (!o) setDetail(null);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
          dir,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
              className: "text-start pe-7",
              children: detail && findingTitle(detail),
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
              className: "text-start",
              children:
                detail &&
                `${name(detail.entry.sector)} · ${detail.entry.label}`,
            }),
            detail &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                import_jsx_runtime.Fragment,
                {
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
                      className: "grid grid-cols-2 gap-4 py-4",
                      children: ["value", "limit"].map((k) =>
                        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                          "div",
                          {
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "dt",
                                {
                                  className: "text-xs text-muted-foreground",
                                  children: t(k),
                                },
                              ),
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                                "dd",
                                {
                                  className: "text-2xl mt-2",
                                  children: number(detail.entry[k]),
                                },
                              ),
                            ],
                          },
                          k,
                        ),
                      ),
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                      className: "text-xs text-muted-foreground",
                      children: t("disclaimer"),
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                      variant: "ink",
                      disabled: reviewed.includes(detail.id),
                      onClick: () => {
                        setReviewed((p) => [...p, detail.id]);
                        setDetail(null);
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {}),
                        t(reviewed.includes(detail.id) ? "reviewed" : "review"),
                      ],
                    }),
                  ],
                },
              ),
          ],
        }),
      }),
    ],
  });
}
//#endregion
export { Workspace, auditSectors, allDatasets, runAudit, segmentDoc, matchRegulation };
