# Tech Modernization & Performance — Design

## Goal

Modernize the mother-log dependency stack and clear security debt without
disturbing the just-shipped Graphite Glass redesign or changing any app
behavior. This is the **balanced** slice of the original roadmap's Phase 3:
React 18→19, security fixes, safe dependency bumps, dead-dependency removal,
and a light performance pass. **Offline support and disruptive major
migrations (Tailwind v4, Vite major) are explicitly out of scope.**

## Context (baseline, verified 2026-06-24)

- React **18.3.1**, Vite **5.4.21**, Tailwind **3.4.19**, Vitest **4.1.2**.
- Test safety net (built in Phase 0): **106 Vitest + 17 Playwright**, all green.
  This is the regression guard for the React 19 upgrade.
- PWA: installable, minimal `public/sw.js` (caches only `/` + `/index.html`).
  Untouched this phase (offline is out of scope).
- Code-splitting already in place: `ClonesTab`, `StatsTab`, `DryRoomTab`,
  `MotherDetail` are `lazy()` + `Suspense`; `qrcode` is dynamically imported.
- Data layer: Supabase key-value (`app_data` table), realtime via
  `subscribeToKey`. Not changed this phase.

### Security advisories (npm audit)

6 advisories (3 high, 2 moderate, 1 low), all in **transitive** deps:

- `ws` 8.0.0–8.20.1 — high (uninitialized memory disclosure; memory-exhaustion
  DoS).
- `undici` — moderate (HTTP response queue poisoning; Set-Cookie SameSite
  downgrade).

`npm audit fix` resolves all of these **without** breaking changes (no
`--force` needed).

### Outdated dependencies

| Package                                                                    | Current | Target       | Action                               |
| -------------------------------------------------------------------------- | ------- | ------------ | ------------------------------------ |
| react / react-dom                                                          | 18.3.1  | 19.2.x       | **Upgrade**                          |
| @supabase/supabase-js                                                      | 2.100.1 | 2.108.x      | Safe minor                           |
| lucide-react                                                               | 1.7.0   | 1.21.x       | Safe minor                           |
| vitest / @vitest/ui                                                        | 4.1.2   | 4.1.9        | Safe minor                           |
| @vitejs/plugin-react                                                       | 4.7.0   | (cond.)      | Bump **only if** React 19 needs it   |
| prettier / postcss / autoprefixer / jsdom / lint-staged / @playwright/test | —       | latest patch | Safe patch                           |
| recharts                                                                   | 3.8.1   | —            | **Remove (dead dep)**                |
| tailwindcss                                                                | 3.4.19  | (hold 3.x)   | **Out of scope** (v4 is a migration) |
| vite                                                                       | 5.4.21  | (hold 5.x)   | **Out of scope** (major jump)        |

`recharts` is imported nowhere (`StatsTab` uses a hand-rolled SVG chart); it is
already tree-shaken from the bundle but still installed.

### Bundle baseline (gzip)

- `index` (main): 194 KB / 58 KB gzip
- `tab-clones`: **264 KB / 67 KB gzip** — the one heavyweight (ClonesTab.jsx is
  ~2,500 lines); already lazy, loads only when Clones is opened.
- All other chunks < 36 KB.

## Approach

Sequenced so **each step ends with a green test suite and an independent
commit**, isolating any regression (especially the React 19 step). Executed on
branch `feature/tech-modernization`.

### Step 1 — Security fixes

Run `npm audit fix` (non-breaking only). Confirm `npm audit` reports no
high/moderate advisories afterward. Run full suite. Commit.

### Step 2 — Remove dead `recharts`

`npm uninstall recharts`. Confirm build succeeds and tests pass (nothing
imports it). Commit. Frees install weight; no bundle change expected (already
tree-shaken).

### Step 3 — React 18 → 19

- Bump `react` + `react-dom` to 19.2.x.
- Audit the codebase for React-19 breaking changes before/while upgrading:
  removed string refs, `propTypes`/`defaultProps` on function components,
  legacy context, `ReactDOM.render`/`hydrate` (app already uses `createRoot`).
  Run the official React 19 codemods if any are flagged.
- Bump `@vitejs/plugin-react` **only if** required for React 19 + Fast Refresh.
  Prefer staying on Vite 5 to avoid a disruptive major; if the plugin bump
  forces a Vite bump, take the **minimum** compatible version, not latest.
- Full suite (106 Vitest + 17 Playwright) must stay green. Manual smoke of the
  app shell. Commit.

### Step 4 — Safe dependency bumps

Bump `@supabase/supabase-js`, `lucide-react`, `vitest`/`@vitest/ui`, and the
dev-tool patches (prettier, postcss, autoprefixer, jsdom, lint-staged,
@playwright/test). Group sensibly; run the suite after any bump with real
runtime surface (supabase, lucide). Commit.

### Step 5 — Performance pass (light)

Re-measure the bundle after recharts removal. **Stretch, not required:** if
`ClonesTab`'s modal / bulk-action sub-components can be split into their own
lazy chunk as a _clean_ win, do it; otherwise log the measurement and stop
(the tab is already lazy, so the marginal benefit is small). Do not refactor
ClonesTab's logic — split only if it's a low-risk mechanical extraction.

## Out of scope

- **Offline / PWA data** (cache reads, queue writes, sync) — dropped this phase.
- **Service worker changes** beyond what already exists.
- **Tailwind v4** migration.
- **Vite major** upgrade (beyond a minimum bump if React 19 strictly requires
  it).
- Any **behavior, data-model, or UI** change. This phase is invisible to users
  except for being faster/safer.

## Constraints & conventions (must honor)

- 106 Vitest + 17 Playwright stay green after every step.
- Each step is its own commit; the React 19 step is isolated so it can be
  reverted independently if needed.
- Prod build stays clean; no e2e fixtures ship (`e2e-fixtures` /
  `VITE_E2E_MOCK` absent from `dist/`).
- Branch `feature/tech-modernization`; do not push `main` (Vercel auto-deploys)
  without explicit user confirmation.
- Fallback: if React 19 proves disruptive, drop it and ship the
  security+cleanup subset (Steps 1, 2, 4, 5) on React 18.

## Testing strategy

- The existing suite is the regression guard — no new test types needed.
- Run `npm test` (Vitest) + `npx playwright test` (mock dev server) after each
  step; both must pass.
- Verify `npm audit` is clean after Step 1 and still clean at the end.
- Verify `npm run build` succeeds and chunk sizes don't regress.

## Next step

Hand off to the writing-plans skill for a step-by-step implementation plan,
then execute via subagent-driven development (same flow as the redesign).
