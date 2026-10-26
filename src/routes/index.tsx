import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/rasd/workspace.jsx";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "رصد | مساحة تحليل بياناتك" },
      { name: "description", content: "حلّل مدخلات الأنشطة السبعة وصدّر تقاريرك." },
      { property: "og:title", content: "رصد | مساحة تحليل بياناتك" },
      { property: "og:description", content: "حلّل مدخلاتك وصدّر تقاريرك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});
