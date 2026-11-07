import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ALLOWED_HOSTS,
  MAX_REDIRECTS,
  allowedHosts,
  fetchLegalPdf,
  isAllowedHost,
  isPrivateAddress,
  legalFetchEnabled,
  maxBytesFromEnv,
  validateUrl,
  type GetFn,
  type RawResponse,
} from "../server/legal-fetch.ts";

const HOSTS = [...DEFAULT_ALLOWED_HOSTS];
const PUBLIC = [{ address: "93.184.216.34", family: 4 as const }];
const pdf = (n = 100) => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(n, 65)]);
const ok = (body: Buffer, headers: Record<string, string> = {}): RawResponse => ({ status: 200, headers, body });
const redirect = (location: string, status = 302): RawResponse => ({ status, headers: { location }, body: Buffer.alloc(0) });

describe("allowlist", () => {
  it("contains exactly the four official Jordanian sites by default", () => {
    expect(HOSTS.sort()).toEqual([
      "csb.gov.jo",
      "gtd.gov.jo",
      "modee.gov.jo",
      "mof.gov.jo",
      "mola.gov.jo",
      "portal.jordan.gov.jo",
      "spac.gov.jo",
    ]);
    expect(allowedHosts({}).sort()).toEqual(HOSTS.sort());
  });
  it("accepts the domain and its subdomains, nothing that merely resembles it", () => {
    expect(isAllowedHost("gtd.gov.jo", HOSTS)).toBe(true);
    expect(isAllowedHost("www.gtd.gov.jo", HOSTS)).toBe(true);
    expect(isAllowedHost("evilgtd.gov.jo", HOSTS)).toBe(false);
    expect(isAllowedHost("gtd.gov.jo.evil.com", HOSTS)).toBe(false);
    expect(isAllowedHost("mof.gov.sa", HOSTS)).toBe(false); // موقع وزارة المالية السعودية
    expect(isAllowedHost("mof.gov.il", HOSTS)).toBe(false);
  });
  it("extra hosts via env must end in .gov.jo", () => {
    const h = allowedHosts({ LEGAL_FETCH_EXTRA_HOSTS: "jbsc.gov.jo, evil.com, x.gov.jo.evil.com, ,pm.gov.jo" });
    expect(h).toContain("jbsc.gov.jo");
    expect(h).toContain("pm.gov.jo");
    expect(h).not.toContain("evil.com");
    expect(h).not.toContain("x.gov.jo.evil.com");
  });
  it("can be switched off and the size cap is bounded", () => {
    expect(legalFetchEnabled({})).toBe(true);
    expect(legalFetchEnabled({ LEGAL_FETCH: "off" })).toBe(false);
    expect(maxBytesFromEnv({})).toBe(25 * 1024 * 1024);
    expect(maxBytesFromEnv({ LEGAL_FETCH_MAX_MB: "5" })).toBe(5 * 1024 * 1024);
    expect(maxBytesFromEnv({ LEGAL_FETCH_MAX_MB: "100000" })).toBe(25 * 1024 * 1024);
  });
});

describe("validateUrl", () => {
  it("accepts https on an allowed host and upgrades http", () => {
    const a = validateUrl("https://www.gtd.gov.jo/ebv4.0/root_storage/ar/eb_list_page/2024.pdf", HOSTS);
    expect(a.ok && a.url.hostname).toBe("www.gtd.gov.jo");
    const b = validateUrl("http://csb.gov.jo/x.pdf", HOSTS);
    expect(b.ok && b.url.protocol).toBe("https:");
  });
  it("rejects other hosts, schemes, ports, credentials and IP literals", () => {
    for (const u of [
      "https://example.com/a.pdf",
      "https://gtd.gov.jo.evil.com/a.pdf",
      "https://mof.gov.sa/a.pdf",
      "ftp://gtd.gov.jo/a.pdf",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://gtd.gov.jo:8443/a.pdf",
      "https://user:pass@gtd.gov.jo/a.pdf",
      "https://gtd.gov.jo@evil.com/a.pdf",
      "https://127.0.0.1/a.pdf",
      "https://[::1]/a.pdf",
      "https://169.254.169.254/latest/meta-data",
      "not a url",
      "",
    ]) {
      expect(validateUrl(u, HOSTS).ok, u).toBe(false);
    }
  });
  it("normalises a trailing dot and case", () => {
    const r = validateUrl("https://GTD.GOV.JO./a.pdf", HOSTS);
    expect(r.ok && r.url.hostname).toBe("gtd.gov.jo");
  });
});

describe("isPrivateAddress", () => {
  it("blocks private, loopback, link-local and reserved ranges", () => {
    for (const ip of [
      "0.0.0.0", "10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1",
      "100.64.0.1", "198.18.0.1", "224.0.0.1", "255.255.255.255",
      "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1",
      "::ffff:7f00:1", "64:ff9b::7f00:1", "2002:7f00:1::1", "2001:db8::1", "garbage",
      "192.88.99.1", "fec0::1", "100::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("allows ordinary public addresses", () => {
    for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe("fetchLegalPdf", () => {
  const url = "https://www.gtd.gov.jo/ebv4.0/root_storage/ar/eb_list_page/2024.pdf";

  it("returns the PDF bytes and the final URL", async () => {
    const get = vi.fn<GetFn>(async () => ok(pdf()));
    const r = await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => PUBLIC, get });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.subarray(0, 5).toString()).toBe("%PDF-");
      expect(r.finalUrl).toBe(url);
    }
    // الاتصال مثبَّت على العنوان الذي فُحص
    expect(get.mock.calls[0]![1]).toEqual(PUBLIC[0]);
  });

  it("never calls the network for a disallowed host", async () => {
    const get = vi.fn<GetFn>();
    const resolve = vi.fn(async () => PUBLIC);
    const r = await fetchLegalPdf("https://example.com/a.pdf", { hosts: HOSTS, resolve, get });
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(get).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("refuses when DNS points an allowed name at a private address (rebinding)", async () => {
    const get = vi.fn<GetFn>();
    for (const address of ["127.0.0.1", "10.0.0.5", "169.254.169.254", "::1"]) {
      const r = await fetchLegalPdf(url, {
        hosts: HOSTS,
        resolve: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
        get,
      });
      expect(r, address).toMatchObject({ ok: false, status: 403 });
    }
    // وإن رجع أحد العناوين خاصاً من بين عدة عناوين
    const mixed = await fetchLegalPdf(url, {
      hosts: HOSTS,
      resolve: async () => [...PUBLIC, { address: "192.168.0.9", family: 4 }],
      get,
    });
    expect(mixed).toMatchObject({ ok: false, status: 403 });
    expect(get).not.toHaveBeenCalled();
  });

  it("follows redirects only to allowed hosts and re-checks DNS on every hop", async () => {
    const seen: string[] = [];
    const get: GetFn = async (u) => {
      seen.push(u.hostname + u.pathname);
      return u.hostname === "www.gtd.gov.jo" ? redirect("https://gtd.gov.jo/final.pdf", 301) : ok(pdf());
    };
    const resolve = vi.fn(async () => PUBLIC);
    const r = await fetchLegalPdf(url, { hosts: HOSTS, resolve, get });
    expect(r.ok && r.finalUrl).toBe("https://gtd.gov.jo/final.pdf");
    expect(seen).toEqual(["www.gtd.gov.jo/ebv4.0/root_storage/ar/eb_list_page/2024.pdf", "gtd.gov.jo/final.pdf"]);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it("supports relative redirects", async () => {
    let n = 0;
    const get: GetFn = async () => (n++ === 0 ? redirect("/files/a.pdf") : ok(pdf()));
    const r = await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => PUBLIC, get });
    expect(r.ok && r.finalUrl).toBe("https://www.gtd.gov.jo/files/a.pdf");
  });

  it("blocks redirects to other hosts, internal addresses and non-https schemes", async () => {
    for (const target of [
      "https://evil.com/a.pdf",
      "http://169.254.169.254/latest/meta-data",
      "https://127.0.0.1/a.pdf",
      "file:///etc/passwd",
      "https://mof.gov.sa/a.pdf",
    ]) {
      const get: GetFn = async () => redirect(target);
      const r = await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => PUBLIC, get });
      expect(r, target).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("stops after too many redirects", async () => {
    const get = vi.fn<GetFn>(async () => redirect("/loop.pdf"));
    const r = await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => PUBLIC, get });
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(get).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it("rejects HTML pages and anything that is not really a PDF, whatever the headers say", async () => {
    const html = ok(Buffer.from("<html><body>hello</body></html>"), { "content-type": "application/pdf" });
    const r = await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => PUBLIC, get: async () => html });
    expect(r).toMatchObject({ ok: false, status: 415 });
  });

  it("enforces the size limit", async () => {
    const r = await fetchLegalPdf(url, {
      hosts: HOSTS,
      maxBytes: 50,
      resolve: async () => PUBLIC,
      get: async () => ok(pdf(500)),
    });
    expect(r).toMatchObject({ ok: false, status: 413 });
  });

  it("maps upstream errors to clear statuses", async () => {
    const mk = (status: number): GetFn => async () => ({ status, headers: {}, body: Buffer.alloc(0) });
    expect(await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => PUBLIC, get: mk(404) })).toMatchObject({ status: 404 });
    expect(await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => PUBLIC, get: mk(500) })).toMatchObject({ status: 502 });
    const boom: GetFn = async () => {
      throw Object.assign(new Error("x"), { name: "TimeoutError" });
    };
    expect(await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => PUBLIC, get: boom })).toMatchObject({ status: 504 });
    const tls: GetFn = async () => {
      throw Object.assign(new Error("x"), { code: "CERT_HAS_EXPIRED" });
    };
    expect(await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => PUBLIC, get: tls })).toMatchObject({ status: 502 });
    expect(
      await fetchLegalPdf(url, {
        hosts: HOSTS,
        resolve: async () => {
          throw new Error("ENOTFOUND");
        },
        get: mk(200),
      }),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it("accepts a PDF with a few junk bytes before the header", async () => {
    const body = Buffer.concat([Buffer.from("\n\n  "), pdf()]);
    const r = await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => PUBLIC, get: async () => ok(body) });
    expect(r.ok).toBe(true);
  });
});

describe("fetchLegalPdf: عدة عناوين", () => {
  const url = "https://www.gtd.gov.jo/a.pdf";
  const V4 = { address: "93.184.216.34", family: 4 as const };
  const V6 = { address: "2606:4700:4700::1111", family: 6 as const };

  it("يجرّب IPv4 أولاً ثم يتجاوز إلى العنوان التالي عند فشل الاتصال", async () => {
    const seen: string[] = [];
    const get = vi.fn<GetFn>(async (_u, ip) => {
      seen.push(ip.address);
      if (ip.family === 4) throw Object.assign(new Error("x"), { code: "ENETUNREACH" });
      return ok(pdf());
    });
    const r = await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => [V6, V4], get });
    expect(r.ok).toBe(true);
    expect(seen).toEqual([V4.address, V6.address]);
  });

  it("لا يجرّب عنواناً آخر عند فشل الشهادة", async () => {
    const get = vi.fn<GetFn>(async () => {
      throw Object.assign(new Error("x"), { code: "ERR_TLS_CERT_ALTNAME_INVALID" });
    });
    const r = await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => [V4, V6], get });
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("يفشل بنتيجة 502 إن فشلت كل العناوين", async () => {
    const get = vi.fn<GetFn>(async () => {
      throw Object.assign(new Error("x"), { code: "ECONNREFUSED" });
    });
    const r = await fetchLegalPdf(url, { hosts: HOSTS, resolve: async () => [V4, V6], get });
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(get).toHaveBeenCalledTimes(2);
  });
});
