import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OfflineDownload } from "@/rasd/OfflineDownload.tsx";

const status = (o: object) => new Response(JSON.stringify(o), { status: 200 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OfflineDownload", () => {
  it("لا يظهر إن كانت الميزة معطّلة", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => status({ enabled: false, available: false })));
    const { container } = render(<OfflineDownload />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("يظهر معطّلاً إن لم تُبنَ الحزمة", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => status({ enabled: true, available: false })));
    render(<OfflineDownload />);
    const b = await screen.findByRole("button", { name: "تحميل النسخة بدون إنترنت" });
    expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it("يتحقق من الكلمة محلياً، ثم يرسلها POST وينزّل الملف", async () => {
    const fn = vi.fn(async (_u: string, init?: RequestInit) =>
      init?.method === "POST" ? new Response("zip", { status: 200 }) : status({ enabled: true, available: true }),
    );
    vi.stubGlobal("fetch", fn);
    (URL as any).createObjectURL = vi.fn(() => "blob:x");
    (URL as any).revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<OfflineDownload />);
    fireEvent.click(await screen.findByRole("button", { name: "تحميل النسخة بدون إنترنت" }));
    fireEvent.click(await screen.findByText("التالي"));
    const [a, b] = Array.from(document.querySelectorAll("input[type=password]")) as HTMLInputElement[];

    fireEvent.change(a, { target: { value: "قصيرة" } });
    fireEvent.change(b, { target: { value: "قصيرة" } });
    fireEvent.click(screen.getByText("تنزيل"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/قصيرة/);
    expect(fn.mock.calls.some((c) => c[1]?.method === "POST")).toBe(false);

    fireEvent.change(a, { target: { value: "كلمة-طويلة-123" } });
    fireEvent.change(b, { target: { value: "مختلفة-طويلة-123" } });
    fireEvent.click(screen.getByText("تنزيل"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/غير متطابقتين/);

    fireEvent.change(b, { target: { value: "كلمة-طويلة-123" } });
    fireEvent.click(screen.getByText("تنزيل"));
    await screen.findByTestId("offline-done");
    const post = fn.mock.calls.find((c) => c[1]?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({ password: "كلمة-طويلة-123" });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("يعرض الشرح المتحرك أولاً بدون حقل كلمة مرور، ثم ينتقل لكلمة المرور", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => status({ enabled: true, available: true })));
    render(<OfflineDownload />);
    fireEvent.click(await screen.findByRole("button", { name: "تحميل النسخة بدون إنترنت" }));
    expect(screen.getByTestId("offline-guide")).toBeTruthy();
    expect(document.querySelectorAll("input[type=password]").length).toBe(0);
    fireEvent.click(screen.getByText("التالي"));
    expect(document.querySelectorAll("input[type=password]").length).toBe(2);
    fireEvent.click(screen.getByText("رجوع"));
    expect(screen.getByTestId("offline-guide")).toBeTruthy();
  });

  it("فيديو الشرح خطوة مستقلة يمكن تخطّيها لتكمل الخطوة التالية", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => status({ enabled: true, available: true })));
    const real = document.createElement.bind(document);
    let vid: any = null;
    vi.spyOn(document, "createElement").mockImplementation(((tag: string, o?: any) => {
      const el = real(tag, o);
      if (tag === "video") vid = el;
      return el;
    }) as any);
    render(<OfflineDownload />);
    await waitFor(() => expect(vid).not.toBeNull());
    await act(async () => vid.onloadedmetadata?.());
    fireEvent.click(await screen.findByRole("button", { name: "تحميل النسخة بدون إنترنت" }));
    expect(screen.getByTestId("offline-video-step")).toBeTruthy();
    expect(screen.queryByTestId("offline-guide")).toBeNull();
    fireEvent.click(screen.getByText("تخطي"));
    expect(screen.getByTestId("offline-guide")).toBeTruthy();
    vi.restoreAllMocks();
  });

  it("يعرض رسالة الخادم عند الفشل", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) =>
        init?.method === "POST" ? new Response(JSON.stringify({ error: "يجري تجهيز حزمة أخرى" }), { status: 503 }) : status({ enabled: true, available: true }),
      ),
    );
    render(<OfflineDownload />);
    fireEvent.click(await screen.findByRole("button", { name: "تحميل النسخة بدون إنترنت" }));
    fireEvent.click(await screen.findByText("التالي"));
    const [a, b] = Array.from(document.querySelectorAll("input[type=password]")) as HTMLInputElement[];
    fireEvent.change(a, { target: { value: "كلمة-طويلة-123" } });
    fireEvent.change(b, { target: { value: "كلمة-طويلة-123" } });
    fireEvent.click(screen.getByText("تنزيل"));
    expect((await screen.findByRole("alert")).textContent).toContain("يجري تجهيز");
  });
});
