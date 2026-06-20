# Phase 0 — Safety Net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the e2e suite deterministic and production-safe, and add per-tab render + interaction smoke coverage, so the upcoming visual redesign cannot silently break behavior.

**Architecture:** Today Playwright runs against the live Vercel production URL using real Supabase grow-room data — fragile and unsafe for any interaction test. This phase introduces an env-gated **mock data layer** inside `src/supabase.js` (seeded from a fixtures module), points Playwright at a **local dev server** running with that mock, then adds per-tab render smoke and a Mothers interaction smoke. There is no app-level auth gate (the app loads straight to tabs), so "auth setup" from the backlog is reinterpreted as this determinism/isolation work.

**Tech Stack:** React 18 + Vite 5 + Tailwind 3, Vitest 4 (unit), Playwright (`@playwright/test`, Pixel 5 mobile viewport), Supabase JS.

## Global Constraints

- `subscribeToKey()` returns `{ unsubscribe }` — cleanup is `return () => unsub.unsubscribe()`, never `return unsub`.
- `saveToDB(key, value, updatedAt)` — always pass a timestamp 3rd arg (echo-filter dedup). The mock must accept the same 3-arg signature.
- The mock branch MUST be dead code in production builds — gated on `import.meta.env.VITE_E2E_MOCK === "1"`, which is never set in the Vercel build. No secrets, fixtures, or mock paths ship to prod beyond the (tree-shakeable) import.
- Mobile-first: all Playwright specs run under the existing `mobile-chrome` (Pixel 5) project.
- Push to `main` auto-deploys via Vercel — do NOT push as part of this plan; commit locally only. Pushing is a separate, explicit step the user authorizes.
- Existing convention: pure logic lives in `*-utils.js` with Vitest tests; components import primitives from `src/shared.jsx`.

## File Structure

- **Create** `src/e2e-fixtures.js` — deterministic in-memory seed store keyed by Supabase data key; exports `load(key)` / `save(key, value)` / `reset()`. One responsibility: supply fake DB data for tests/local dev.
- **Create** `src/e2e-fixtures.test.js` — Vitest unit tests for the fixtures module.
- **Modify** `src/supabase.js` — add a mock branch at the top of `loadFromDB` / `saveToDB` / `subscribeToKey`, gated on `VITE_E2E_MOCK`.
- **Modify** `playwright.config.ts` — add `webServer` (local dev with `VITE_E2E_MOCK=1`); default `baseURL` to `http://localhost:5173`; preserve `PLAYWRIGHT_BASE_URL` override (which also disables the local server).
- **Create** `tests/e2e/helpers.ts` — `gotoApp(page)` and `openTab(page, label)` shared helpers.
- **Create** `tests/e2e/tabs.spec.ts` — per-tab render smoke for all 7 tabs.
- **Create** `tests/e2e/mothers.spec.ts` — Mothers interaction smoke (quick-log hub sheet + detail modal).
- **Modify** `tests/e2e/smoke.spec.ts` — no code change required, but it now runs against the local mock server (verified in Task 2).
- **Create** `.env.example` — document `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, and `VITE_E2E_MOCK`.

---

### Task 1: E2E mock data layer

**Files:**

- Create: `src/e2e-fixtures.js`
- Create: `src/e2e-fixtures.test.js`
- Modify: `src/supabase.js` (top of `loadFromDB`, `saveToDB`, `subscribeToKey`)
- Create: `.env.example`

**Interfaces:**

- Produces: `load(key: string): Promise<any|null>`, `save(key: string, value: any): Promise<void>`, `reset(): void` from `src/e2e-fixtures.js`. Seed keys: `mothers_v1` (array of mother objects), `clone_trays_v1` (array), `clone_plants_v1` (`[]`). All other keys resolve to `null` (empty states).
- Consumes (mother shape, verified in `src/App.jsx:54` `defaultMother()`): `{ id, strainCode, status, location, healthLevel, healthLog, notes, transplantHistory, amendmentLog, cloneLog, feedingLog, reductionLog, photos, createdAt }`. Strain names resolve via `getStrain(strainCode)` (`src/shared.jsx`); `"2002"` → "Grape Cake Mintz", `"2009"` → "Larry Bird Mintz".
- Consumes (tray shape, verified in `src/stats-utils.js:120` `calcTrayRates`): `{ status, count, survived, strainCode, strainName }`; only `status: "Done"` trays with non-null `count` and `survived` count toward stats.

- [ ] **Step 1: Write the failing test**

Create `src/e2e-fixtures.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { load, save, reset } from "./e2e-fixtures";

describe("e2e-fixtures", () => {
  beforeEach(() => reset());

  it("returns seeded mothers for mothers_v1", async () => {
    const mothers = await load("mothers_v1");
    expect(Array.isArray(mothers)).toBe(true);
    expect(mothers.length).toBeGreaterThan(0);
    expect(mothers[0]).toHaveProperty("id");
    expect(mothers[0]).toHaveProperty("strainCode");
    expect(mothers[0]).toHaveProperty("status");
  });

  it("returns at least one Done tray with count and survived", async () => {
    const trays = await load("clone_trays_v1");
    const done = trays.filter(
      (t) => t.status === "Done" && t.count != null && t.survived != null
    );
    expect(done.length).toBeGreaterThan(0);
  });

  it("returns null for unknown keys (empty state)", async () => {
    expect(await load("room_v1")).toBeNull();
    expect(await load("facility_v1")).toBeNull();
  });

  it("save overwrites and load reflects it", async () => {
    await save("mothers_v1", []);
    expect(await load("mothers_v1")).toEqual([]);
  });

  it("reset restores the original seed", async () => {
    await save("mothers_v1", []);
    reset();
    const mothers = await load("mothers_v1");
    expect(mothers.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/e2e-fixtures.test.js`
Expected: FAIL — `Failed to resolve import "./e2e-fixtures"` (module does not exist yet).

- [ ] **Step 3: Create the fixtures module**

Create `src/e2e-fixtures.js`:

```js
// Deterministic in-memory seed for e2e tests and credential-free local dev.
// Activated only when VITE_E2E_MOCK === "1" (see supabase.js). Never ships to prod.

const SEED = {
  mothers_v1: [
    {
      id: "m-2002",
      strainCode: "2002", // Grape Cake Mintz
      status: "Active",
      location: "A1",
      healthLevel: 4,
      healthLog: [],
      notes: "",
      transplantHistory: [],
      amendmentLog: [],
      cloneLog: [],
      feedingLog: [],
      reductionLog: [],
      photos: [],
      createdAt: "2026-01-15",
    },
    {
      id: "m-2009",
      strainCode: "2009", // Larry Bird Mintz
      status: "Active",
      location: "A2",
      healthLevel: 3,
      healthLog: [],
      notes: "",
      transplantHistory: [],
      amendmentLog: [],
      cloneLog: [],
      feedingLog: [],
      reductionLog: [],
      photos: [],
      createdAt: "2026-02-01",
    },
  ],
  clone_trays_v1: [
    {
      id: "2002-T1",
      strainCode: "2002",
      strainName: "Grape Cake Mintz",
      count: 50,
      survived: 34,
      status: "Done",
    },
    {
      id: "2009-T1",
      strainCode: "2009",
      strainName: "Larry Bird Mintz",
      count: 40,
      survived: null,
      status: "Active",
    },
  ],
  clone_plants_v1: [],
};

let store = structuredClone(SEED);

export async function load(key) {
  return key in store ? store[key] : null;
}

export async function save(key, value) {
  store[key] = value;
}

export function reset() {
  store = structuredClone(SEED);
}
```

- [ ] **Step 4: Run the fixtures test to verify it passes**

Run: `npx vitest run src/e2e-fixtures.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire the mock branch into `src/supabase.js`**

At the top of the file, after the `createClient` import, add the mock import and flag. Then add an early-return branch to each of the three exported functions. The full edited file:

```js
import { createClient } from "@supabase/supabase-js";
import * as mockDB from "./e2e-fixtures";

// E2E / credential-free local dev: route all DB calls to the in-memory seed.
// VITE_E2E_MOCK is never set in the Vercel production build, so this branch
// (and the fixtures import) tree-shakes out of prod bundles.
const E2E_MOCK = import.meta.env.VITE_E2E_MOCK === "1";

const supabase = E2E_MOCK
  ? null
  : createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_KEY
    );

export async function loadFromDB(key) {
  if (E2E_MOCK) return mockDB.load(key);
  const { data, error } = await supabase
    .from("app_data")
    .select("value")
    .eq("key", key)
    .single();
  // PGRST116 = "no rows found" — expected on first run, not an error
  if (error && error.code !== "PGRST116") {
    console.error("[supabase] loadFromDB failed:", error);
  }
  return data?.value ?? null;
}

// Caller passes in the timestamp so it can be registered in pendingTimestamps
// before the async save starts — preventing echo-overwrite races.
export async function saveToDB(key, value, updatedAt) {
  if (E2E_MOCK) return mockDB.save(key, value);
  const { error } = await supabase
    .from("app_data")
    .upsert({ key, value, updated_at: updatedAt });
  if (error) throw error;
}

// Subscribe to real-time changes on a key.
// callback receives (value, updatedAt) so callers can filter their own saves.
// Returns an object with an unsubscribe() method.
export function subscribeToKey(key, callback) {
  if (E2E_MOCK) return { unsubscribe: () => {} };
  const channel = supabase
    .channel(`app_data:${key}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "app_data",
        filter: `key=eq.${key}`,
      },
      (payload) => {
        callback(payload.new?.value, payload.new?.updated_at);
      }
    )
    .subscribe((status, err) => {
      if (err) console.error("[supabase] realtime subscribe error:", err);
    });
  return { unsubscribe: () => supabase.removeChannel(channel) };
}
```

- [ ] **Step 6: Add `.env.example`**

Create `.env.example`:

```
# Supabase (production / real data). Anon (publishable) key only — never a service-role key.
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-publishable-key

# Set to 1 to use the in-memory mock data layer (e2e tests, credential-free local dev).
# Leave unset/blank for normal operation. Never set in the production build.
# VITE_E2E_MOCK=1
```

- [ ] **Step 7: Run the full unit suite to confirm nothing broke**

Run: `npm test`
Expected: PASS — 106 tests (101 existing + 5 new).

- [ ] **Step 8: Commit**

```bash
git add src/e2e-fixtures.js src/e2e-fixtures.test.js src/supabase.js .env.example
git commit -m "test: add env-gated mock data layer for deterministic e2e"
```

---

### Task 2: Point Playwright at a local dev server with the mock

**Files:**

- Modify: `playwright.config.ts`
- (Verifies, no change) `tests/e2e/smoke.spec.ts`

**Interfaces:**

- Consumes: the `VITE_E2E_MOCK` flag from Task 1.
- Produces: a Playwright config whose default `baseURL` is `http://localhost:5173`, backed by a `webServer` running `npm run dev` with `VITE_E2E_MOCK=1`. Setting `PLAYWRIGHT_BASE_URL` overrides `baseURL` and disables the local server (so preview/prod targeting still works).

- [ ] **Step 1: Update `playwright.config.ts`**

Replace the file with:

```ts
import { defineConfig, devices } from "@playwright/test";

// Default: run against a local dev server using the in-memory mock (deterministic,
// no real Supabase data touched). Pass PLAYWRIGHT_BASE_URL to target a deployed
// preview/prod instead — that also disables the local server.
const previewURL = process.env.PLAYWRIGHT_BASE_URL;
const LOCAL_URL = "http://localhost:5173";
const baseURL = previewURL ?? LOCAL_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Mobile-first — matches primary use case
    ...devices["Pixel 5"],
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  // Only start a local server when targeting localhost (no preview override).
  webServer: previewURL
    ? undefined
    : {
        command: "npm run dev",
        url: LOCAL_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: { VITE_E2E_MOCK: "1" },
      },
});
```

- [ ] **Step 2: Run the existing smoke spec against the local mock**

Run: `npx playwright test tests/e2e/smoke.spec.ts`
Expected: PASS — Playwright auto-starts the dev server, both smoke tests pass against `http://localhost:5173` with mock data. (No production URL contacted, no real data touched.)

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "test: run e2e against local dev server with mock data layer"
```

---

### Task 3: Per-tab render smoke

**Files:**

- Create: `tests/e2e/helpers.ts`
- Create: `tests/e2e/tabs.spec.ts`

**Interfaces:**

- Produces: `gotoApp(page)` (navigates to `/`, waits for tab nav) and `openTab(page, label)` (clicks a tab button by accessible name) from `tests/e2e/helpers.ts`.
- Consumes: tab labels from `src/App.jsx:40` `TAB_ITEMS`: `Summary`, `Mothers`, `Room`, `Facility`, `Stats`, `Dry Room`, `Clones`.

- [ ] **Step 1: Write the helpers**

Create `tests/e2e/helpers.ts`:

```ts
import { expect, type Page } from "@playwright/test";

// Navigate to the app and wait for the tab bar to be interactive.
export async function gotoApp(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: /mothers/i })).toBeVisible({
    timeout: 15000,
  });
}

// Click a tab by its visible label (e.g. "Dry Room").
export async function openTab(page: Page, label: string) {
  const tab = page
    .getByRole("button", { name: new RegExp(label, "i") })
    .first();
  await tab.click();
  // Lazy tabs (Clones/Stats/DryRoom) render via Suspense — allow the chunk to load.
  await page.waitForLoadState("networkidle");
}
```

- [ ] **Step 2: Write the failing per-tab spec**

Create `tests/e2e/tabs.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { gotoApp, openTab } from "./helpers";

const TABS = [
  "Summary",
  "Mothers",
  "Room",
  "Facility",
  "Stats",
  "Dry Room",
  "Clones",
];

test.describe("each tab renders without crashing", () => {
  for (const label of TABS) {
    test(`${label} tab renders`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      await gotoApp(page);
      await openTab(page, label);

      // The tab content area should be visible and the app must not have thrown.
      await expect(page.locator("body")).toBeVisible();
      expect(
        errors,
        `uncaught errors on ${label}: ${errors.join(" | ")}`
      ).toEqual([]);
    });
  }
});

test("Stats tab shows seeded survival data", async ({ page }) => {
  await gotoApp(page);
  await openTab(page, "Stats");
  // Seed has one Done tray: 34/50 = 68% survival (Grape Cake Mintz).
  await expect(page.getByText(/68\s*%/)).toBeVisible({ timeout: 15000 });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx playwright test tests/e2e/tabs.spec.ts`
Expected: FAIL — `Cannot find module './helpers'` is resolved (Task 3 Step 1 created it), so the real expected first-run failure is only if a tab throws. If all tabs are green on first run, that is acceptable — the value is the spec existing and passing. If the `68%` assertion fails, inspect how `StatsTab` renders the rate and adjust the matcher to the actual rendered text (e.g. `68.0%`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test tests/e2e/tabs.spec.ts`
Expected: PASS — 8 tests (7 tabs + Stats data assertion).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/helpers.ts tests/e2e/tabs.spec.ts
git commit -m "test: add per-tab render smoke with seeded data"
```

---

### Task 4: Mothers interaction smoke

**Files:**

- Create: `tests/e2e/mothers.spec.ts`

**Interfaces:**

- Consumes: `gotoApp`, `openTab` from `tests/e2e/helpers.ts`. Mother card tap opens the quick-log hub sheet (2×2 grid: Water / Amendment / Clone Cut / Reduction) with a "View Details →" button (per `project-mother-log` memory, shipped 2026-04-05). Seed strain `"2002"` renders as "Grape Cake Mintz".

- [ ] **Step 1: Write the failing interaction spec**

Create `tests/e2e/mothers.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { gotoApp, openTab } from "./helpers";

test("mother card opens the quick-log hub sheet", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await gotoApp(page);
  await openTab(page, "Mothers");

  // Seeded mother renders by strain name.
  const card = page.getByText(/Grape Cake Mintz/i).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();

  // Quick-log hub: at least one of the four actions is visible.
  await expect(
    page.getByText(/Water|Amendment|Clone Cut|Reduction/i).first()
  ).toBeVisible();
  expect(errors, errors.join(" | ")).toEqual([]);
});

test("quick-log hub opens the full detail modal", async ({ page }) => {
  await gotoApp(page);
  await openTab(page, "Mothers");

  await page
    .getByText(/Grape Cake Mintz/i)
    .first()
    .click();
  const viewDetails = page.getByRole("button", { name: /view details/i });
  await expect(viewDetails).toBeVisible({ timeout: 15000 });
  await viewDetails.click();

  // Detail modal exposes its tabs (Overview is the default detail tab).
  await expect(page.getByText(/Overview/i).first()).toBeVisible();
});
```

- [ ] **Step 2: Run to verify it fails (then iterate to green)**

Run: `npx playwright test tests/e2e/mothers.spec.ts`
Expected: FAIL on first run if the card/sheet selectors don't match the live DOM. Open the trace (`npx playwright show-trace`) or run headed (`npx playwright test tests/e2e/mothers.spec.ts --headed`) to read the actual rendered text, then adjust the selectors (the mother card may surface the strain name inside a heading or a `data`-attribute rather than bare text). The behavior under test — card tap → hub sheet → View Details → detail modal — is fixed; only the selectors adapt.

- [ ] **Step 3: Run to verify it passes**

Run: `npx playwright test tests/e2e/mothers.spec.ts`
Expected: PASS — 2 tests.

- [ ] **Step 4: Full verification — unit + e2e green**

Run: `npm test && npx playwright test`
Expected: Vitest 106 passed; Playwright 12 passed (2 smoke + 8 tabs + 2 mothers).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/mothers.spec.ts
git commit -m "test: add Mothers interaction smoke (quick-log hub + detail modal)"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-06-19-mother-log-full-upgrade-design.md`, Phase 0):

- "Expand test/e2e coverage so the redesign cannot silently break behavior" → Tasks 3 & 4 (per-tab render smoke + Mothers interaction smoke).
- "Playwright auth setup … beyond the current pre-auth smoke" → reinterpreted (no app auth exists) as deterministic, prod-safe e2e via mock data layer + local server → Tasks 1 & 2. This reinterpretation is documented in the Architecture section above.
- Security cross-cutting: mock is env-gated and tree-shakes from prod (Task 1 Step 5 comment + Global Constraints); `.env.example` states anon-key-only, never service-role (Task 1 Step 6); no real data touched by tests (Task 2).

**Placeholder scan:** No "TBD"/"implement later". Tasks 3 & 4 contain instructions to adapt _selectors_ to the live DOM — this is genuine e2e practice (selectors can only be finalized against rendered output), and the behavior under test is fully specified, so it is not a content placeholder.

**Type/name consistency:** `load`/`save`/`reset` signatures match between `e2e-fixtures.js`, its test, and the `supabase.js` branch. `VITE_E2E_MOCK` spelled identically in fixtures comment, `supabase.js`, `playwright.config.ts`, and `.env.example`. `gotoApp`/`openTab` defined in `helpers.ts` and consumed identically in `tabs.spec.ts` and `mothers.spec.ts`. Tab labels match `TAB_ITEMS` in `App.jsx`.

**Test count math:** 101 existing + 5 fixtures = 106 Vitest. Playwright: 2 (smoke) + 8 (tabs: 7 + Stats data) + 2 (mothers) = 12.
