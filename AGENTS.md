<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The Rasd UI lives in src/rasd/workspace.jsx (recovered from a compiled build, plain JS with jsx() calls). The audit engine was extracted verbatim to src/rasd/audit-engine.js: activities are defined in its auditSectors array, parameters in defaultParams, and checks in runAudit. workspace.jsx re-exports them, so existing imports keep working; edit engine logic in audit-engine.js.
- src/styles.css is the precompiled stylesheet from the original build; reuse existing classes, since new Tailwind classes are not generated.
