import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { startAutoSync } from "@/rasd/sync.js";
import { initDurableStorage } from "@/rasd/durable-storage.js";
import { Workspace } from "@/rasd/workspace.jsx";
import { AssistantChat } from "@/rasd/AssistantChat.jsx";
import { AuthGate } from "@/components/AuthGate";

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
  component: HomeGate,
});

function HomeGate() {
  return (
    <AuthGate>
      <Home />
    </AuthGate>
  );
}

function Home() {
  // Durable storage: restore audit results / reports from IndexedDB (if localStorage was cleared) *before* the workspace
  // reads them, then mirror every later write. Never blocks longer than a few seconds (see initDurableStorage).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    initDurableStorage()
      .catch(() => undefined)
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // mirrors the workspace to the central database when the user enabled sync (no-op otherwise)
  useEffect(() => (ready ? startAutoSync() : undefined), [ready]);

  if (!ready)
    return (
      <div role="status" dir="rtl" style={{ padding: "3rem", textAlign: "center" }}>
        جارٍ تحميل بياناتك المحفوظة…
      </div>
    );
  return (
    <>
      <Workspace />
      <AssistantChat />
    </>
  );
}
