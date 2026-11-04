import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocReviewPanel } from "@/rasd/DocReviewPanel.jsx";
import { CHECKLIST } from "@/rasd/doc-review.js";

describe("DocReviewPanel (static render)", () => {
  const html = renderToStaticMarkup(createElement(DocReviewPanel));
  it("renders the controls, with the run button disabled until there is text", () => {
    expect(html).toContain('data-testid="doc-review"');
    expect(html).toContain('data-testid="doc-review-file"');
    expect(html).toMatch(/data-testid="doc-review-run"[^>]*disabled|disabled[^>]*data-testid="doc-review-run"/);
    expect(html).toContain(`(${CHECKLIST.length} بنود)`);
  });
  it("states plainly that 'not found' is an indicator, not a violation", () => {
    expect(html).toContain("ليس مخالفة");
  });
  it("tells the auditor what is redacted and offers a field for extra terms", () => {
    expect(html).toContain('data-testid="doc-review-terms"');
    expect(html).toContain("يُحجب تلقائياً قبل الإرسال");
    expect(html).toContain("اسم بلا لقب لا يُحجب إلا إن كتبته هنا");
  });
  it("shows no results before a review", () => {
    expect(html).not.toContain("doc-review-results");
  });
});
