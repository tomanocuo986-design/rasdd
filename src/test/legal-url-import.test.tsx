import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LegalUrlImport, OFFICIAL_PRESETS, nameFromUrl } from "@/rasd/LegalUrlImport.tsx";

const HOSTS6 = [
  "mola.gov.jo",
  "csb.gov.jo",
  "mof.gov.jo",
  "gtd.gov.jo",
  "modee.gov.jo",
  "portal.jordan.gov.jo",
];
const pdfBlob = () => new Blob(["%PDF-1.7 test"], { type: "application/pdf" });

function mockFetch(
  post: () => Response,
  hosts: string[] = ["mola.gov.jo", "csb.gov.jo", "mof.gov.jo", "gtd.gov.jo"],
) {
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") return post();
    return new Response(JSON.stringify({ enabled: true, hosts }), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("nameFromUrl", () => {
  it("takes the last path segment, decodes Arabic and drops .pdf", () => {
    expect(nameFromUrl("https://www.gtd.gov.jo/ebv4.0/root_storage/ar/eb_list_page/2024.pdf")).toBe(
      "2024",
    );
    expect(
      nameFromUrl(
        "https://gtd.gov.jo/ebv4.0/root_storage/ar/eb_list_page/%D8%A7%D9%84%D8%AF%D9%84%D9%8A%D9%84_2023.pdf",
      ),
    ).toBe("الدليل 2023");
    expect(nameFromUrl("https://gtd.gov.jo/")).toBe("نظام من رابط");
    expect(nameFromUrl("???")).toBe("نظام من رابط");
  });
});

describe("LegalUrlImport", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the allowed sites", async () => {
    mockFetch(() => new Response(pdfBlob()));
    render(<LegalUrlImport onFile={async () => {}} />);
    await waitFor(() =>
      expect(screen.getByTestId("legal-url-import")).toHaveTextContent("gtd.gov.jo"),
    );
    expect(screen.getByTestId("legal-url-import")).toHaveTextContent("mola.gov.jo");
  });

  it("keeps the button disabled until a URL is typed", () => {
    mockFetch(() => new Response(pdfBlob()));
    render(<LegalUrlImport onFile={async () => {}} />);
    expect(screen.getByRole("button", { name: "إضافة من رابط" })).toBeDisabled();
  });

  it("fetches through the server and hands a PDF File plus the source note to onFile", async () => {
    const f = mockFetch(
      () =>
        new Response(pdfBlob(), {
          status: 200,
          headers: {
            "x-final-url": encodeURIComponent(
              "https://gtd.gov.jo/files/%D9%86%D8%B8%D8%A7%D9%85.pdf",
            ),
          },
        }),
    );
    const onFile = vi.fn(async () => {});
    render(<LegalUrlImport onFile={onFile} />);
    fireEvent.change(screen.getByLabelText("رابط ملف PDF للنظام أو التعليمات"), {
      target: { value: "https://gtd.gov.jo/start.pdf" },
    });
    fireEvent.click(screen.getByRole("button", { name: "إضافة من رابط" }));
    await waitFor(() => expect(onFile).toHaveBeenCalledTimes(1));

    const [file, meta] = onFile.mock.calls[0] as unknown as [File, { sourceNote: string }];
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("نظام.pdf");
    expect(file.type).toBe("application/pdf");
    expect(meta.sourceNote).toContain("https://gtd.gov.jo/files/");
    expect(meta.sourceNote).toMatch(/بتاريخ \d{4}-\d{2}-\d{2}$/);

    const post = f.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe("/api/legal-fetch");
    expect(JSON.parse(String(post[1]!.body))).toEqual({ url: "https://gtd.gov.jo/start.pdf" });
    await waitFor(() =>
      expect(screen.getByLabelText("رابط ملف PDF للنظام أو التعليمات")).toHaveValue(""),
    );
  });

  it("shows the server's message and does not import when the fetch is refused", async () => {
    mockFetch(() => new Response(JSON.stringify({ error: "الموقع غير مسموح." }), { status: 403 }));
    const onFile = vi.fn(async () => {});
    render(<LegalUrlImport onFile={onFile} />);
    fireEvent.change(screen.getByLabelText("رابط ملف PDF للنظام أو التعليمات"), {
      target: { value: "https://example.com/a.pdf" },
    });
    fireEvent.click(screen.getByRole("button", { name: "إضافة من رابط" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("الموقع غير مسموح."));
    expect(onFile).not.toHaveBeenCalled();
  });

  it("hides itself when the server has the feature switched off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ enabled: false, hosts: [] }), { status: 200 }),
      ),
    );
    render(<LegalUrlImport onFile={async () => {}} />);
    await waitFor(() => expect(screen.queryByTestId("legal-url-import")).toBeNull());
  });
  it("lists the ready-made official regulations and imports one with its title as the file name", async () => {
    const f = mockFetch(() => new Response(pdfBlob(), { status: 200 }), HOSTS6);
    const onFile = vi.fn(async () => {});
    render(<LegalUrlImport onFile={onFile} />);
    const first = OFFICIAL_PRESETS[0]!;
    fireEvent.click(screen.getByRole("button", { name: `إضافة ${first.title}` }));
    await waitFor(() => expect(onFile).toHaveBeenCalledTimes(1));
    const [file] = onFile.mock.calls[0] as unknown as [File];
    expect(file.name).toBe(`${first.title}.pdf`);
    const post = f.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ url: first.url });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: `إضافة ${first.title}` })).toBeDisabled(),
    );
  });

  it("adds all presets one after another", async () => {
    mockFetch(() => new Response(pdfBlob(), { status: 200 }), HOSTS6);
    const onFile = vi.fn(async () => {});
    render(<LegalUrlImport onFile={onFile} />);
    fireEvent.click(screen.getByRole("button", { name: "إضافة الكل" }));
    await waitFor(() => expect(onFile).toHaveBeenCalledTimes(OFFICIAL_PRESETS.length));
  });

  it("every preset URL is https on an allowed host", () => {
    for (const p of OFFICIAL_PRESETS) {
      const u = new URL(p.url);
      expect(u.protocol).toBe("https:");
      expect(HOSTS6.some((h) => u.hostname === h || u.hostname.endsWith("." + h))).toBe(true);
    }
  });
});
