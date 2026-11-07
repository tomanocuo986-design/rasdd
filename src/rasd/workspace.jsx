// @ts-nocheck
/* eslint-disable */
import { LayoutGrid, FileChartColumn, ShieldCheck, BookOpen, History, FileSpreadsheet, Radar, Settings2, CircleHelp as CircleQuestionMark, Search, Globe, Sun, Moon, Bell, ArrowLeft, Check, X, Activity, Building2, Trash2, Download } from "lucide-react";
import * as import_react from "react";
import { publishAssistantContext } from "./assistant-context.js";
import * as import_jsx_runtime from "react/jsx-runtime";
import { OfflineDownload } from "./OfflineDownload";
import radarImg from "@/assets/radar-sculpture.jpg";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, Area } from "recharts";
import { AuditReport } from "./AuditReport";
import { auditSectors, allDatasets, runAudit } from "./audit-engine.js";
import { isRtl, languages, translator } from "./i18n.js";
import { analyzeEntries, datasetLabel, import_papaparse, loadReports, seedDemoFromUrl, sevClass, sevLabel } from "./audit-support.js";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Switch } from "./ui-primitives.jsx";
import { SectorAudit } from "./SectorAudit.jsx";
import { downloadReportDocx, downloadReportPdf } from "./report-export.jsx";
import { matchRegulation, segmentDoc } from "./regulation-match.js";

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
      try {
        localStorage.setItem(
          "rasd-preferences",
          JSON.stringify({
            language,
            night,
            motion,
            compact,
          }),
        );
      } catch {
        /* التخزين ممتلئ أو معطّل (وضع التصفح الخاص): التفضيلات لا تُحفظ لكن الشاشة لا تنهار */
      }
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
export { Workspace, auditSectors, allDatasets, runAudit, segmentDoc, matchRegulation };
