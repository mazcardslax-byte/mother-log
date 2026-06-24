# Tech Modernization & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the mother-log dependency stack (React 18→19, safe bumps), clear all security advisories, and remove dead weight — with zero behavior change and the test suite green after every step.

**Architecture:** Dependency/config work, not feature code. There is no TDD red→green cycle — the existing **106 Vitest + 16 Playwright** suite is the regression guard. Each task is a bump-or-removal followed by `npm test` + `npx playwright test` + `npm run build`, then an isolated commit so any regression (especially React 19) can be reverted alone.

**Tech Stack:** React 18.3→19, Vite 5 (held), Tailwind 3 (held), Vitest, Playwright, npm.

## Global Constraints

- **106 Vitest + 16 Playwright stay green after every task.** Commands: `npm test` and `npx playwright test` (Playwright auto-starts the mock dev server via `webServer`; do not start a server manually).
- **No behavior, data-model, UI, or test-assertion changes.** This phase is invisible to users. Do not edit `src/**` component logic except where a React-19 breaking change strictly requires it.
- **`npm run build` must succeed** after every task; prod bundle must not ship e2e fixtures (`grep -rE "e2e-fixtures|VITE_E2E_MOCK" dist/` → no matches).
- **Hold these majors (out of scope):** `tailwindcss` (stay 3.x), `vite` (stay 5.x unless React 19 strictly forces a minimum bump — then take the _minimum_ compatible version, not latest).
- **Each task = its own commit.** The React 19 task is isolated so it can be reverted independently.
- Branch: `feature/tech-modernization`. Do **not** push `main` (Vercel auto-deploys) without explicit user confirmation.
- Reference: spec at `docs/superpowers/specs/2026-06-24-tech-modernization-design.md`.
- Windows + Git Bash environment; npm is the package manager (there is a `package-lock.json`).

---

### Task 1: Security fixes (`npm audit fix`)

**Files:**

- Modify: `package.json`, `package-lock.json` (via npm)

**Interfaces:**

- Produces: a dependency tree with no high/moderate advisories; transitive `ws` and `undici` bumped to patched versions.

- [ ] **Step 1: Record the baseline advisory count**

Run: `npm audit`
Expected: 6 vulnerabilities (1 low, 2 moderate, 3 high) — `ws` (high), `undici` (moderate). Note this for comparison.

- [ ] **Step 2: Apply non-breaking fixes**

Run: `npm audit fix`
(Do NOT use `--force` — that pulls breaking majors which are out of scope.)

- [ ] **Step 3: Verify advisories cleared**

Run: `npm audit`
Expected: 0 high and 0 moderate advisories. (If a low remains that only `--force` would fix, leave it and note it in the report — do not force.)

- [ ] **Step 4: Verify nothing broke**

Run: `npm test`
Expected: 106 passed.
Run: `npx playwright test`
Expected: 16 passed.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: npm audit fix — clear ws/undici advisories"
```

---

### Task 2: Remove dead `recharts` dependency

**Files:**

- Modify: `package.json`, `package-lock.json` (via npm)

**Interfaces:**

- Consumes: clean tree from Task 1.
- Produces: `recharts` absent from `package.json`. No source change (it is imported nowhere).

- [ ] **Step 1: Confirm recharts is truly unused**

Run: `grep -rni "recharts" src/`
Expected: only the comment `// ─── SVG Line Chart (no recharts) ───` in `src/StatsTab.jsx` — i.e. NO `import` of recharts. If any real import exists, STOP and report (do not remove).

- [ ] **Step 2: Uninstall**

Run: `npm uninstall recharts`

- [ ] **Step 3: Verify build + tests**

Run: `npm run build`
Expected: build succeeds (StatsTab's hand-rolled SVG chart is unaffected).
Run: `npm test`
Expected: 106 passed.
Run: `npx playwright test`
Expected: 16 passed.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused recharts dependency"
```

---

### Task 3: React 18 → 19

**Files:**

- Modify: `package.json`, `package-lock.json`
- Possibly modify: `src/**` ONLY if a React-19 breaking change strictly requires it (see Step 2). `vite.config.js` only if a `@vitejs/plugin-react` bump is required.

**Interfaces:**

- Consumes: clean tree from Tasks 1–2.
- Produces: `react` + `react-dom` at `^19.2.0`; app builds and all tests pass on React 19.

- [ ] **Step 1: Pre-flight — scan for React-19 breaking-change usage**

Run each grep; each should return NO matches (if any matches, note the file:line — it must be migrated in Step 4):

```bash
grep -rnE "\bpropTypes\b|\.defaultProps\b" src/        # removed for function components in React 19
grep -rnE "ref=\"[^\"]+\"" src/                          # string refs removed
grep -rnE "ReactDOM\.(render|hydrate)\b" src/            # legacy roots removed (should already be createRoot)
grep -rnE "getChildContext|childContextTypes|contextTypes\b" src/  # legacy context removed
```

Expected: all empty (the app already uses `createRoot` in `src/main.jsx` and function components with hooks). Record results in the report.

- [ ] **Step 2: Check the React-19 / Vite-plugin compatibility floor**

The current `@vitejs/plugin-react` is 4.7.0 on Vite 5.4.21. React 19 only needs a JSX-runtime-capable plugin; 4.7.0 supports the automatic runtime and React 19. Do **not** bump the plugin unless Step 5 surfaces a Fast-Refresh/build error. If a bump proves necessary, install the **lowest** `@vitejs/plugin-react` version that supports React 19 on Vite 5 — do NOT jump to a version that requires Vite 6+.

- [ ] **Step 3: Install React 19**

Run: `npm install react@^19.2.0 react-dom@^19.2.0`

- [ ] **Step 4: Apply migrations only if Step 1 found matches**

If Step 1 was all-empty, skip this step. Otherwise, for each match, apply the React-19 migration (e.g. `propTypes` → remove or convert to TS-free runtime check deletion; string ref → callback ref; `ReactDOM.render` → `createRoot`). If the official codemod applies, run it:
`npx codemod@latest react/19/migration-recipe` — review its diff, keep only changes within `src/`, discard unrelated edits. Re-run the Step 1 greps to confirm clean.

- [ ] **Step 5: Verify build + full suite on React 19**

Run: `npm run build`
Expected: build succeeds with no React-version or plugin errors. (If a Fast-Refresh/JSX error appears, perform the minimal `@vitejs/plugin-react` bump per Step 2, then rebuild.)
Run: `npm test`
Expected: 106 passed.
Run: `npx playwright test`
Expected: 16 passed.

- [ ] **Step 6: Confirm no fixture leak in prod bundle**

Run: `grep -rE "e2e-fixtures|VITE_E2E_MOCK" dist/ ; echo "exit=$?"`
Expected: `exit=1` (no matches).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: upgrade React 18 → 19"
```

(If React 19 proved disruptive and could not be made green, per the spec fallback: `git reset --hard HEAD` / leave React at 18, report BLOCKED with the specific breakage, and skip to Task 4.)

---

### Task 4: Safe dependency bumps

**Files:**

- Modify: `package.json`, `package-lock.json`

**Interfaces:**

- Consumes: tree from Tasks 1–3.
- Produces: `@supabase/supabase-js@^2.108`, `lucide-react@^1.21`, `vitest`/`@vitest/ui`@`^4.1.9`, and dev-tool patches at latest, all green.

- [ ] **Step 1: Bump the runtime-surface deps (group A)**

Run: `npm install @supabase/supabase-js@^2.108.2 lucide-react@^1.21.0`
These touch real runtime (DB client + icons), so verify immediately:
Run: `npm test` → Expected: 106 passed.
Run: `npx playwright test` → Expected: 16 passed.
Run: `npm run build` → Expected: succeeds.

- [ ] **Step 2: Bump the dev/test tooling (group B)**

Run: `npm install -D vitest@^4.1.9 @vitest/ui@^4.1.9 @playwright/test@^1.61.1 prettier@latest postcss@latest autoprefixer@latest jsdom@latest lint-staged@latest`
(Keep all within current majors — these are minor/patch per `npm outdated`.)

- [ ] **Step 3: Verify the toolchain still runs**

Run: `npm test`
Expected: 106 passed (Vitest 4.1.9).
Run: `npx playwright test`
Expected: 16 passed.
Run: `npm run build`
Expected: succeeds.
Run: `npm audit`
Expected: still 0 high/moderate (no regression from the bumps).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump supabase-js, lucide-react, and dev tooling"
```

---

### Task 5: Performance measurement (+ optional ClonesTab split)

**Files:**

- Read: `dist/` build output (measurement)
- Possibly modify: `src/ClonesTab.jsx` + a new `src/clones-*.jsx` ONLY if a clean, low-risk lazy split is identified.

**Interfaces:**

- Consumes: modernized tree from Tasks 1–4.
- Produces: a recorded bundle measurement; optionally a smaller `tab-clones` chunk via lazy sub-component extraction (no logic change).

- [ ] **Step 1: Measure the current bundle**

Run: `npm run build`
Record the chunk table. Baseline for comparison (pre-phase): `index` 194 KB / 58 KB gz; `tab-clones` 264 KB / 67 KB gz. Note any change after the dependency work.

- [ ] **Step 2: Decide on the ClonesTab split (gate)**

Inspect `src/ClonesTab.jsx` for self-contained, heavy, conditionally-rendered sub-trees (e.g. the bulk-update modal, promote-round modal, edit modal) that are only shown on user action. A split is worth doing ONLY if a sub-component can be moved to its own file and `lazy()`-loaded with **no shared mutable state crossing the boundary** and **no change to behavior or testids**.

- If NO clean split exists → record "no clean split; tab-clones stays lazy as-is" in the report and **skip to Step 4** (this is an acceptable, expected outcome — do not force a risky refactor).
- If a clean split exists → proceed to Step 3.

- [ ] **Step 3: (Only if Step 2 found a clean split) Extract + lazy-load**

Move the identified sub-component(s) into a new file (e.g. `src/clones-modals.jsx`), import via `lazy()` + wrap the render site in `<Suspense fallback={null}>`. Preserve every `data-testid`, label, and handler exactly. Then verify:
Run: `npm test` → Expected: 106 passed.
Run: `npx playwright test clones-tab tabs` → Expected: pass (the Clones interactions and modals must still work).
Run: `npm run build` → Expected: succeeds; `tab-clones` chunk is smaller than baseline.

- [ ] **Step 4: Commit**

If a split was made (stage the specific source files you changed — do NOT use `git add -A`, which would sweep untracked agent-config dirs):

```bash
git add src/ClonesTab.jsx src/clones-modals.jsx   # adjust to the exact files you created/edited
git commit -m "perf: lazy-load ClonesTab modals to shrink tab-clones chunk"
```

If no split (measurement only), there is nothing to commit for this task — record the measurement in the progress ledger and the task report, and mark the task complete.

---

### Task 6: Final verification

**Files:** repo-wide (read-only checks).

- [ ] **Step 1: Full suite + build**

Run: `npm test` → Expected: 106 passed.
Run: `npx playwright test` → Expected: 16 passed.
Run: `npm run build` → Expected: succeeds.

- [ ] **Step 2: Security + version confirmation**

Run: `npm audit` → Expected: 0 high/moderate.
Run: `node -e "console.log(require('react/package.json').version)"` → Expected: 19.2.x (or, if React 19 was rolled back per fallback, 18.3.x — note which).
Run: `grep -rni "recharts" package.json` → Expected: no match (removed).

- [ ] **Step 3: Prod-bundle leak check**

Run: `grep -rE "e2e-fixtures|VITE_E2E_MOCK" dist/ ; echo "exit=$?"`
Expected: `exit=1` (no matches).

- [ ] **Step 4: Report**

Summarize: final React version, advisories cleared, deps bumped, recharts removed, bundle before/after, whether the ClonesTab split happened. Confirm branch state and ask the user before any `main` merge/push (auto-deploys via Vercel).

---

## Self-Review

- **Spec coverage:** Step 1 security (Task 1) ✓; remove recharts (Task 2) ✓; React 18→19 incl. breaking-change audit + conditional plugin bump + fallback (Task 3) ✓; safe dep bumps (Task 4) ✓; light perf pass as a _gated stretch_ (Task 5) ✓; hold Tailwind v4 / Vite major (Global Constraints) ✓; test-green-every-step + leak check (every task + Task 6) ✓; branch/no-main rule (Global Constraints + Task 6) ✓.
- **Placeholder scan:** every step has the exact command + expected output; the only conditional work (Task 3 Step 4 migration, Task 5 split) is explicitly gated with both branches specified — no "TBD"/"handle edge cases".
- **Type/name consistency:** no cross-task function/type names (dependency work). Version targets are consistent: React `^19.2.0`, supabase-js `^2.108.2`, lucide-react `^1.21.0`, vitest `^4.1.9` across Tasks 3–4 and the Task 6 confirmation. Commands (`npm test`, `npx playwright test`, `npm run build`, `npm audit`) are identical across tasks.
