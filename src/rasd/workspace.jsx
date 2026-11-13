// @ts-nocheck
/* eslint-disable */
import { trackEvent } from "./audit-trail.js";
import * as import_react from "react";
import * as import_jsx_runtime from "react/jsx-runtime";
import {
  Check, ArrowLeft, Bell, Activity, CircleHelp as CircleQuestionMark, BookOpen, FileText,
  SlidersHorizontal, FileChartColumn, Settings2, Radar, Plus, Globe, History, Sun, Search,
  LayoutGrid, Upload, ShieldCheck, Moon, Trash2, ShieldAlert, X, Save, FileSpreadsheet,
  Building2, Download, FileDown, KeyRound,
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
import { auditSectors, allDatasets, defaultParams, runAudit } from "./audit-engine.js";
import {
  listRegulations,
  saveRegulation,
  deleteRegulation,
  updateRegulationMeta,
} from "./secure-regulations";
import { VaultGate, VAULT_ENABLED } from "./VaultGate";
import { openEscrowPanel } from "./VaultEscrowPanel.jsx";
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
  applyEdit,
  applyEdits,
  currentObservations,
  diffEdit,
  draftObservations,
  loadEdits,
  loadIds,
  observationLines,
  saveDraft,
  saveEdits,
  saveIds,
  summarize,
  summaryText,
} from "./observations";
import { AuditReport } from "./AuditReport";
import { buildReportDocx, fetchTemplate } from "./report-docx";
import { ObservationsPanel } from "./ObservationsPanel";
import { ReviewStatsPanel } from "./ReviewStatsPanel";
import { LegalCoveragePanel } from "./LegalCoveragePanel";
import { DocReviewPanel } from "./DocReviewPanel";
import { LibraryMeta } from "./LibraryMeta";
import { LegalUrlImport } from "./LegalUrlImport";
import { OfflineDownload } from "./OfflineDownload";
import { isOfficialDoc, startOfficialSync, syncSummary } from "./official-library";
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
//#region src/rasd/audit-engine.js (استُخرج: محرك التدقيق ← audit-engine.js)
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
async function downloadReportDocx(report, meta) {
  // يُبنى الملف على قالب ديوان المحاسبة نفسه؛ الملاحظات المعتمدة فقط تصل هنا (انظر AuditReport)
  const bytes = await buildReportDocx(await fetchTemplate(), report, meta);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.name}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    key: "extensionMaxPct",
    label: "أقصى نسبة لتمديدات المدة المعتمدة من مدة العقد (%) (0 = غير مفعل، يُدخله المدقق من الشروط العامة للعقد)",
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
  const [officialMsg, setOfficialMsg] = (0, import_react.useState)("");
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
    const refreshDocs = () => listRegulations().then(setDocs).catch(() => {});
    const officialSync = startOfficialSync({
      fetchImpl: (u, i) => fetch(u, i),
      listRegulations,
      saveRegulation,
      deleteRegulation,
      extractPdfPages,
      onProgress: setOfficialMsg,
      onChange: refreshDocs,
    });
    officialSync.done
      .then((r) => {
        setOfficialMsg(syncSummary(r));
        refreshDocs();
      })
      .catch(() => setOfficialMsg(""));
    try {
      setDemoActive(localStorage.getItem(DEMO_FLAG_KEY) === "1");
      setHasDemoSnapshot(!!localStorage.getItem(DEMO_SNAPSHOT_KEY));
    } catch {
      /* storage unavailable */
    }
    setLoaded(true);
    return () => officialSync.stop();
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
  // تعديلات المدقق على صياغة الملاحظات المصاغة آلياً (تبقى بعد إعادة التحليل لأنها مفتاحها معرّف الملاحظة)
  const [obsEdits, setObsEdits] = (0, import_react.useState)(() => loadEdits());
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
  const rawObservations = (0, import_react.useMemo)(
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
  const allObservations = (0, import_react.useMemo)(
    () => applyEdits(rawObservations, obsEdits),
    [rawObservations, obsEdits],
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
          .map((o) => applyEdit({ ...o, status: approvedObs.has(o.id) ? "approved" : "draft" }, obsEdits[o.id])),
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
        // الصياغة الأصلية دون تعديلات المدقق؛ تُطبَّق التعديلات عند الدمج كي لا تضيع المقارنة بالأصل
        observations: rawObservations,
        compliance: comp,
      });
  }, [rawObservations]);
  // تعديل المدقق لصياغة ملاحظة (الحالة/السند/السبب/الأثر/التوصية/التصنيف) مع خيار الاعتماد الفوري
  const editObservation = (o, patch, approve) => {
    // نقارن بالمسودة الأصلية (قبل أي تعديل سابق) كي لا يُخزَّن إلا ما يخالفها فعلاً
    const original = rawObservations.find((x) => x.id === o.id) ?? manualObs.find((x) => x.id === o.id) ?? o;
    const e = diffEdit(original, patch);
    const n = { ...obsEdits };
    if (e) n[o.id] = e;
    else delete n[o.id];
    saveEdits(n);
    setObsEdits(n);
    trackEvent("ui.finding.edit", o.id, `${o.dataset}|${o.test}`);
    if (approve && !approvedObs.has(o.id)) toggleApprove(o.id);
  };
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
  async function addPdfs(files, meta) {
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
          ...(typeof meta?.sourceNote === "string" && meta.sourceNote ? { sourceNote: meta.sourceNote } : {}),
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
              officialMsg
                ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                    className: "mt-1 text-xs text-muted-foreground",
                    role: "status",
                    "data-testid": "official-sync-status",
                    children: officialMsg,
                  })
                : null,
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegalUrlImport, {
                disabled: busy,
                onFile: (file, meta) => addPdfs([file], meta),
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
                            isOfficialDoc(d)
                              ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                                  className: "text-muted-foreground",
                                  title: "مصدره الموقع الرسمي ويتجدد تلقائياً",
                                  children: "رسمي",
                                })
                              : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
        onEdit: editObservation,
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
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocReviewPanel, {}),
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
function WorkspaceInner() {
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
              VAULT_ENABLED &&
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                  variant: "ghost",
                  className: "nav-item",
                  title: "مفتاح الطوارئ",
                  "data-testid": "nav-escrow",
                  onClick: () => openEscrowPanel(),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, {}),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                      className: "nav-text",
                      children: "مفتاح الطوارئ",
                    }),
                  ],
                }),
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
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfflineDownload, {}),
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
                              onExportDocx: (r, meta) => downloadReportDocx(r, meta),
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
function Workspace() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VaultGate, {
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkspaceInner, {}),
  });
}
//#endregion
export { Workspace, auditSectors, allDatasets, runAudit, segmentDoc, matchRegulation };
