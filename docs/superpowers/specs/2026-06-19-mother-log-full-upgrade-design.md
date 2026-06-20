# Mother-Log Full Upgrade — Roadmap Design

**Date:** 2026-06-19
**Status:** Approved (overall design). Each phase below gets its own spec → plan → build → ship cycle.
**Repo:** `C:/Users/zacho/dev/mother-log` · branch `main` · Vercel auto-deploy on push.

## Goal

Fully upgrade the mother-log PWA across four dimensions the user selected: **visual/UX redesign**, **architecture cleanup**, **tech-stack modernization**, and **new features**. The two top-priority drivers are: (1) the app looks dated/clunky, and (2) it's hard to maintain because the big files are large.

## Key insight driving the approach

The two top priorities touch the _same_ files. A visual redesign rewrites the JSX in `ClonesTab.jsx` (1470 lines), `App.jsx` (1466), and `DryRoomTab.jsx` (1223); so does an architecture refactor. Doing them as two separate passes means editing every large file twice. Therefore we **weave reskin and refactor together, tab by tab** (the approved "Option A"): establish the design system once, then each tab gets reskinned _and_ split in a single pass — touching each file once and shipping a polished tab at a time.

## Current state (baseline)

- React 18 + Vite 5 + Tailwind 3 PWA. Supabase key-value JSON store (`app_data` table). Single user, mobile-first dark theme.
- Tabs: Summary · Mothers · Room · Facility · Stats · Dry Room · Clones.
- 101 Vitest tests passing. Playwright installed (mobile-first, pre-auth smoke only — auth setup still pending).
- Shared primitives already centralized in `src/shared.jsx` (Badge, Modal, StatBox, etc.) — components imported from here, never redefined per-file. **This is the foundation the design system extends.**
- Large files: `ClonesTab.jsx` 1470, `App.jsx` 1466, `DryRoomTab.jsx` 1223. Smaller/self-contained: `StatsTab.jsx` 280, `RoomTab.jsx` 356, `FacilityTab.jsx` 142.

## Architecture & phasing

Five phases. Each is independently shippable, ends with a green test suite, and gets its own spec.

### Phase 0 — Safety net

Expand test/e2e coverage so the redesign cannot silently break behavior. Includes the pending **Playwright auth setup** (from the backlog) to enable full tab-interaction e2e tests beyond the current pre-auth smoke. Small but de-risks every later phase.

### Phase 1 — Design system + Stats pilot

Build the impeccable-driven design language and component library in `src/shared.jsx`; prove it end-to-end on the **Stats** tab (smallest, self-contained, lowest-risk — fastest way to lock the visual tokens and core look).

**Design system contents (single source of truth in `shared.jsx`):**

- Design tokens: color, spacing, radius, shadow, motion/timing.
- Upgraded primitives: `Button`, `Card`, `StatBox`, `Badge`, `Modal`, `Sheet`, `Tabs`, form inputs — all dark-mode, mobile-first, with consistent motion and micro-interactions.
- Rule preserved: primitives live in `shared.jsx`, never redefined per file.
- Visual direction is driven by the **impeccable** skill using modern/cutting-edge techniques, anchored to the app's existing identity (mobile-first, dark, grow-room tool). The specific aesthetic is proposed by impeccable at build time and iterated on against the live result rather than pre-mocked.

### Phase 2 — Reskin + split, tab by tab

Roll the design system across the app. Order: **Mothers → Clones → DryRoom → Room/Facility → Summary.** (Mothers is second overall — the most-used screen — to validate the interactive primitives: cards, quick-log sheet, detail modal, forms.)

Each tab in this phase:

- Swaps in the new primitives.
- Extracts sub-components/utils so no file stays over ~400–500 lines.
- Keeps Vitest green and Playwright smoke passing.
- Ships independently.

### Phase 3 — Tech modernization

React 18→19, Vite/dependency bumps, **PWA offline** (cache reads while offline, sync on reconnect — from the backlog), performance and bundle-size work. Done on a clean, good-looking base so upgrades aren't fighting messy code.

### Phase 4 — New features

Its own brainstorm + spec once the base is clean and modern. Candidate ideas deferred to that phase; not scoped here.

## Testing strategy

- **Vitest** remains the pure-logic safety net (`npm test`). Logic stays extracted into `*-utils.js` files with tests, per existing convention.
- **Playwright** (mobile viewport) covers visual/interaction smoke per tab; Phase 0 adds auth so interaction tests can run.
- Every phase ends green before the next begins. No phase merges with failing tests.

## Use of skills & agents

- **impeccable** drives the design system (Phase 1) and each per-tab reskin (Phase 2).
- Subagents used where work is genuinely independent — e.g. running a code review on one tab's refactor while building the next, or parallel file-splitting of unrelated modules. Not used to re-derive context already established.

## Constraints & conventions (must honor)

- `subscribeToKey()` returns `{ unsubscribe }` — cleanup is `return () => unsub.unsubscribe()`.
- `saveToDB(key, value, updatedAt)` — always pass a timestamp 3rd arg (echo-filter dedup).
- Mothers Supabase save is debounced 600ms.
- Clone survival rate reads from `clone_trays_v1` (only `Done` trays with known `count`+`survived`), not `mothers[].cloneLog`.
- Push to `main` auto-deploys via Vercel — confirm deploy status after push rather than running separate deploy commands.

## Security (cross-cutting — applies to every phase)

Security is a standing concern, not a separate phase. Each phase must hold these:

- **No secrets in the client bundle.** Only the Supabase anon/publishable key and project URL belong in the front end (via Vite `VITE_` env vars). Never commit a service-role key or any private secret; verify `.env` is gitignored. Audit the bundle stays clean as deps change.
- **Supabase RLS.** Confirm Row Level Security is enabled on `app_data` (and the `clone_*` tables) so the anon key cannot read/write beyond intended scope. Treat the anon key as public — it is shipped to the browser.
- **Safe rendering.** No `dangerouslySetInnerHTML` with user/DB-sourced content during the reskin; keep all grow-room notes/labels rendered as text. New form inputs validate/escape before save.
- **Dependency hygiene.** Run `npm audit` at Phase 3 (dep bumps) and address high/critical advisories; prefer the React 19 / Vite upgrade path that clears known vulns rather than introducing new transitive risk.
- **PWA/offline cache (Phase 3).** Cache only non-sensitive read data; do not persist secrets in the service-worker cache or localStorage. Scope cache invalidation so stale auth state can't linger.
- **Headers/transport.** Keep Vercel HTTPS-only; confirm no mixed content and reasonable security headers (CSP can be tightened as a Phase 3 task once the asset surface is stable).

## Out of scope

- Backend/Supabase schema redesign (key-value store stays).
- Multi-user/auth product features (single-user tool).
- Specific Phase 4 feature definitions (deferred to their own brainstorm).

## Next step

Phase 0 gets a detailed implementation plan via the writing-plans skill.
