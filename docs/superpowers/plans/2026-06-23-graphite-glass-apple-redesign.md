# Graphite Glass — Apple Dark-Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The per-tab visual polish should be driven through the **impeccable** skill within the guardrails below.

**Goal:** Reskin the mother-log PWA from the Carbon Amber dark/gold theme to an Apple-style "Graphite Glass" look (charcoal surfaces, frosted-glass nav/sheets, SF typography, grouped-inset lists, system-blue accent) with zero behavior change.

**Architecture:** Token-first. Replace the CSS variables in `src/index.css` and the Tailwind `ca` color namespace, then update the centralized style constants and shared components in `src/shared.jsx` — this cascades the new look across every tab automatically. Each tab task then sweeps residual hard-coded `amber-*`/`zinc-*`/hex classes and applies the grouped-list/sheet patterns via impeccable.

**Tech Stack:** React 18, Vite, Tailwind CSS (+ CSS variables), Vitest (unit), Playwright (e2e, mocked via `VITE_E2E_MOCK=1`).

## Global Constraints

- **No behavior changes** — restyle only. Logic, data flow, Supabase calls untouched.
- **106 Vitest tests stay green**, unchanged, after every task. Command: `npm test`.
- **17 Playwright e2e tests stay green.** Preserve every `data-testid` (notably `data-testid="tab-nav"` at `src/App.jsx:768`) and every exact user-facing label, including tab names and the quick-log hub labels **Transplant / Clone / Reduce / Amendment**. Command: `npx playwright test` (Playwright auto-starts the mock dev server via webServer).
- **Accent = `#0A84FF`** (Apple dark system blue). Semantic: green `#30D158`, red `#FF453A`, orange `#FF9F0A`, yellow `#FFD60A`.
- **Surfaces:** `--bg #000000`, `--surface-1 #1C1C1E`, `--surface-2 #2C2C2E`, glass `rgba(28,28,30,0.72)` + `backdrop-blur(20px) saturate(180%)`, separator `rgba(255,255,255,0.08)`.
- **Text:** primary `rgba(255,255,255,0.92)`, secondary `rgba(235,235,245,0.6)`, tertiary `rgba(235,235,245,0.3)`.
- **Font:** system stack `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif`. Drop the DM Sans Google Fonts import.
- **Radius:** cards 14px, buttons 12px, sheets 20px top, pills full.
- Mobile-first PWA; preserve safe-area insets (`.pt-safe`, notch handling).
- Branch: `feature/graphite-glass-apple`. Do **not** push `main` (Vercel auto-deploys main) without explicit user confirmation.
- Prod build must stay clean (no e2e fixtures leaking): `npm run build` succeeds.

---

### Task 1: Design tokens & global styles

**Files:**

- Modify: `src/index.css` (`:root` block, font import, `html, body`)
- Modify: `tailwind.config.js` (color namespace)

**Interfaces:**

- Produces: CSS variables `--bg, --surface-1, --surface-2, --glass, --separator, --accent, --green, --red, --orange, --yellow, --text-primary, --text-secondary, --text-tertiary`; Tailwind color namespace `ag` (apple-graphite) mirroring them; a `.glass` utility class; `.press-card` retained.

- [ ] **Step 1: Replace the token block in `src/index.css`**

Remove the DM Sans `@import url(...)` line. Replace the `:root` "Carbon Amber" block with:

```css
/* ── Graphite Glass Design Tokens (Apple dark) ───────────────────────────── */
:root {
  --bg: #000000;
  --surface-1: #1c1c1e;
  --surface-2: #2c2c2e;
  --glass: rgba(28, 28, 30, 0.72);
  --separator: rgba(255, 255, 255, 0.08);
  --accent: #0a84ff;
  --green: #30d158;
  --red: #ff453a;
  --orange: #ff9f0a;
  --yellow: #ffd60a;
  --text-primary: rgba(255, 255, 255, 0.92);
  --text-secondary: rgba(235, 235, 245, 0.6);
  --text-tertiary: rgba(235, 235, 245, 0.3);
}
```

Update `html, body` to:

```css
html,
body {
  overscroll-behavior: none;
  background-color: var(--bg);
  color: var(--text-primary);
  font-family:
    -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
    system-ui, sans-serif;
}
```

Add a glass utility (keep existing `.press-card`, `.pt-safe`, scrollbar rules):

```css
.glass {
  background-color: var(--glass);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
}
```

- [ ] **Step 2: Replace the `ca` namespace in `tailwind.config.js` with `ag`**

```js
colors: {
  ag: {
    bg:        "#000000",
    surface:   "#1c1c1e",
    "surface-2": "#2c2c2e",
    border:    "rgba(255,255,255,0.08)",
    accent:    "#0a84ff",
    green:     "#30d158",
    red:       "#ff453a",
    orange:    "#ff9f0a",
    yellow:    "#ffd60a",
    text:      "rgba(255,255,255,0.92)",
    body:      "rgba(235,235,245,0.6)",
    muted:     "rgba(235,235,245,0.3)",
  },
},
```

- [ ] **Step 3: Run unit tests**

Run: `npm test`
Expected: PASS — 106 tests. (Tokens don't affect logic; this confirms nothing broke on import.)

- [ ] **Step 4: Run prod build**

Run: `npm run build`
Expected: build succeeds, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/index.css tailwind.config.js
git commit -m "feat: Graphite Glass design tokens + system font"
```

---

### Task 2: Centralized style constants (shared.jsx)

**Files:**

- Modify: `src/shared.jsx:201-204` (`inputCls`, `selectCls`, `btnPrimary`, `btnSecondary`) and the badge/health color helper constants (`HEALTH_BADGE_CLASSES`, `statusBadgeColor`, threshold class lists).

**Interfaces:**

- Consumes: tokens from Task 1.
- Produces: same exported constant **names** (`inputCls`, `selectCls`, `btnPrimary`, `btnSecondary`) with Apple-glass styling — every tab importing them updates automatically.

- [ ] **Step 1: Replace the four style constants**

```js
export const inputCls =
  "w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3.5 py-2.5 text-[17px] text-white/90 placeholder-white/30 focus:outline-none focus:border-[#0a84ff] focus-visible:ring-2 focus-visible:ring-[#0a84ff]/40";
export const selectCls =
  "w-full bg-[#1c1c1e] border border-white/10 rounded-xl px-3.5 py-2.5 text-[17px] text-white/90 focus:outline-none focus:border-[#0a84ff] focus-visible:ring-2 focus-visible:ring-[#0a84ff]/40";
export const btnPrimary =
  "w-full bg-[#0a84ff] hover:bg-[#0a84ff]/90 active:bg-[#0a6fd6] text-white font-semibold text-[17px] rounded-xl py-3 transition-colors min-h-[44px]";
export const btnSecondary =
  "w-full bg-[#0a84ff]/10 hover:bg-[#0a84ff]/15 active:bg-[#0a84ff]/20 text-[#0a84ff] font-medium text-[17px] rounded-xl py-2.5 transition-colors min-h-[44px]";
```

- [ ] **Step 2: Re-map status/health badge color helpers to semantic tokens**

In `statusBadgeColor` map Active → green tint (`"bg-[#30d158]/15 text-[#30d158]"`), Sidelined → gray (`"bg-white/10 text-white/50"`). In `HEALTH_BADGE_CLASSES` and the threshold class arrays, replace amber/zinc Tailwind classes with the semantic palette: 5/4 → green, 3 → yellow, 2 → orange, 1 → red (tint form `bg-[#hex]/15 text-[#hex]`). Keep the exact same keys/return shape.

- [ ] **Step 3: Run unit tests**

Run: `npm test`
Expected: PASS — 106 tests (helpers return strings; assert any tests on these still pass; if a test asserts a specific old class string, update that test's expected value to the new class).

- [ ] **Step 4: Commit**

```bash
git add src/shared.jsx
git commit -m "feat: Apple-blue glass style constants + semantic badge colors"
```

---

### Task 3: Shared components — Sheet, Badge, StatBox + new primitives

**Files:**

- Modify: `src/shared.jsx` (`Modal` → glass bottom-sheet, `Badge`, `StatBox`, `SectionLabel`, `FormField`)
- Add to `src/shared.jsx`: `GroupedList`, `GroupedRow`, `SegmentedControl` primitives.

**Interfaces:**

- Produces:
  - `Modal({ title, onClose, children })` — unchanged signature, now renders as a frosted bottom sheet (grabber handle, 20px top radius, slide-up).
  - `GroupedList({ children })` — rounded `surface-1` container with hairline-divided rows.
  - `GroupedRow({ left, right, onClick })` — a single inset row; chevron when `onClick` present.
  - `SegmentedControl({ options, value, onChange })` — Apple pill segmented control.
  - `Badge`, `StatBox`, `SectionLabel`, `FormField` — same signatures, restyled.

- [ ] **Step 1: Convert `Modal` to a glass bottom sheet**

Keep the `{ title, onClose, children }` signature and any existing `data-testid`. Render: full-screen dimmed backdrop (`bg-black/50`, click closes) + bottom-anchored panel `glass rounded-t-[20px]`, a centered 36px grabber handle (`h-1 w-9 rounded-full bg-white/25`), title as Headline (`text-[17px] font-semibold text-white/90`), `pb-safe` for home-indicator inset, slide-up via a `translate-y` transition.

- [ ] **Step 2: Add `GroupedList`, `GroupedRow`, `SegmentedControl`**

```jsx
export function GroupedList({ children }) {
  return (
    <div className="bg-[#1c1c1e] rounded-2xl overflow-hidden divide-y divide-white/[0.08]">
      {children}
    </div>
  );
}

export function GroupedRow({ left, right, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`press-card flex items-center justify-between w-full text-left px-4 py-3 min-h-[44px] ${onClick ? "active:bg-white/5" : ""}`}
    >
      <span className="text-[17px] text-white/90">{left}</span>
      <span className="flex items-center gap-2 text-[15px] text-white/50">
        {right}
        {onClick && <span className="text-white/25">›</span>}
      </span>
    </Tag>
  );
}

export function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex bg-white/[0.06] rounded-[10px] p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 text-[13px] font-medium rounded-[8px] py-1.5 transition-colors min-h-[32px] ${
            value === opt ? "bg-[#0a84ff] text-white" : "text-white/60"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Restyle `Badge`, `StatBox`, `SectionLabel`, `FormField`**

`Badge` → pill `rounded-full px-2 py-0.5 text-[13px]` honoring `colorClass`. `StatBox` → `bg-[#1c1c1e] rounded-2xl p-4`, value as Title `text-[22px] font-bold`. `SectionLabel` → uppercase Footnote `text-[13px] text-white/50 font-medium px-1`. `FormField` label → Subhead `text-[15px] text-white/60`. Keep all signatures and any `data-testid`.

- [ ] **Step 4: Run unit tests**

Run: `npm test`
Expected: PASS — 106 tests.

- [ ] **Step 5: Run the e2e suite (smoke that nothing regressed yet)**

Run: `npx playwright test`
Expected: PASS — 17 tests (Modal-based interactions in mothers.spec still pass; if a selector targeted Modal markup that changed, update the selector — not the test intent).

- [ ] **Step 6: Commit**

```bash
git add src/shared.jsx
git commit -m "feat: glass bottom-sheet + GroupedList/Row/SegmentedControl primitives"
```

---

### Task 4: Tab bar + app header (App.jsx)

**Files:**

- Modify: `src/App.jsx` — the tab nav at `:768` (`data-testid="tab-nav"`) and the screen header region.

**Interfaces:**

- Consumes: `.glass` utility (Task 1).
- Produces: frosted bottom tab bar (hairline top border, blue active / gray inactive), iOS large-title header.

- [ ] **Step 1: Restyle the tab bar**

On the `data-testid="tab-nav"` container apply `glass` + `border-t border-white/10` + `pb-safe`. **Move it to the bottom** if it isn't already (Apple tab bars are bottom-anchored on mobile). Active tab: `text-[#0a84ff]`; inactive: `text-white/40`. Labels `text-[11px]`. **Do not change tab keys or label text** — `setTab(key)` logic and the exact strings stay identical.

- [ ] **Step 2: Restyle the header to large-title**

Screen title rendered as Large Title `text-[34px] font-bold tracking-tight text-white/90`, left-aligned, inside the `.pt-safe` header. (Optional progressive enhancement — collapse-on-scroll — is out of scope for this task; static large title is sufficient.)

- [ ] **Step 3: Run e2e tabs spec**

Run: `npx playwright test tabs`
Expected: PASS — `openTab` (scoped to `data-testid="tab-nav"`, `exact: true`) still resolves every tab; per-tab render smoke green.

- [ ] **Step 4: Run unit tests + commit**

Run: `npm test` → PASS 106.

```bash
git add src/App.jsx
git commit -m "feat: frosted glass tab bar + large-title header"
```

---

### Task 5: Mothers tab + quick-log hub + MotherDetail sheet

**Files:**

- Modify: `src/App.jsx` (Mothers list + quick-log hub) and `src/MotherDetail.jsx`.

**Interfaces:** Consumes Task 2/3 constants + `GroupedList`, `Modal`-as-sheet.

- [ ] **Step 1: Reskin mother cards**

Sweep residual `amber-*`/`zinc-*`/`#fbbf24`/`#0a0a0a` classes → tokens (`amber-*` accent → `#0a84ff`; warm body text `#c5b08a`/`text-ca-body` → `text-white/60`; card bg → `bg-[#1c1c1e]`). Cards: `rounded-2xl border border-white/10`. Preserve every `data-testid` and the mother card tap target.

- [ ] **Step 2: Verify quick-log hub labels**

Confirm the hub still renders exactly **Transplant / Clone / Reduce / Amendment** and uses the sheet-style `Modal`. Do not rename.

- [ ] **Step 3: Reskin `MotherDetail.jsx`**

Apply grouped-inset rows (`GroupedList`/`GroupedRow`) for Overview detail rows; `DETAIL_TABS` switch → `SegmentedControl`. Photos grid: rounded `rounded-xl` tiles. Preserve testids.

- [ ] **Step 4: Run mothers e2e + unit**

Run: `npx playwright test mothers` → PASS. Run: `npm test` → PASS 106.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/MotherDetail.jsx
git commit -m "feat: Graphite Glass — Mothers tab + detail sheet"
```

---

### Task 6: Clones tab

**Files:** Modify `src/ClonesTab.jsx`.

- [ ] **Step 1:** Sweep `amber-*`/`zinc-*`/warm-hex classes → tokens (accent `#0a84ff`, surface `#1c1c1e`, text `white/90`·`white/60`, hairline `white/10`). Badges → semantic tints. Cards `rounded-2xl border border-white/10`. Preserve testids/labels.
- [ ] **Step 2:** Run `npx playwright test clones-tab tabs` → PASS; `npm test` → PASS 106.
- [ ] **Step 3:** Commit: `git commit -am "feat: Graphite Glass — Clones tab"`

---

### Task 7: Dry Room tab

**Files:** Modify `src/DryRoomTab.jsx`.

- [ ] **Step 1:** Same token sweep + grouped/badge patterns as Task 6. Preserve testids/labels.
- [ ] **Step 2:** Run `npx playwright test tabs` → PASS; `npm test` → PASS 106.
- [ ] **Step 3:** Commit: `git commit -am "feat: Graphite Glass — Dry Room tab"`

---

### Task 8: Stats tab (cards + charts)

**Files:** Modify `src/StatsTab.jsx`.

- [ ] **Step 1:** Metric cards → `StatBox`/`bg-[#1c1c1e] rounded-2xl`. Restyle the existing chart (do not swap libraries): thin strokes in `#0a84ff`/`#30d158`, hairline gridlines `rgba(255,255,255,0.08)`, no heavy fills. Sweep residual amber/zinc.
- [ ] **Step 2:** Run `npx playwright test tabs` (Stats render smoke; the 68%/value assertions must still find their text) → PASS; `npm test` → PASS 106.
- [ ] **Step 3:** Commit: `git commit -am "feat: Graphite Glass — Stats tab + Health-style charts"`

---

### Task 9: Facility tab

**Files:** Modify `src/FacilityTab.jsx`.

- [ ] **Step 1:** Convert lists → `GroupedList`/`GroupedRow` inset style; token sweep. Preserve testids/labels.
- [ ] **Step 2:** Run `npx playwright test tabs` → PASS; `npm test` → PASS 106.
- [ ] **Step 3:** Commit: `git commit -am "feat: Graphite Glass — Facility tab"`

---

### Task 10: Add form (RoomTab)

**Files:** Modify `src/RoomTab.jsx`.

- [ ] **Step 1:** Convert the add form to grouped-inset rows; inputs already inherit new `inputCls`/`selectCls` from Task 2. Submit uses `btnPrimary`. Token sweep on residual classes. Preserve testids/labels.
- [ ] **Step 2:** Run `npx playwright test tabs` → PASS; `npm test` → PASS 106.
- [ ] **Step 3:** Commit: `git commit -am "feat: Graphite Glass — Add form"`

---

### Task 11: Final verification & cleanup

**Files:** repo-wide.

- [ ] **Step 1: Residual-class audit**

Run: `grep -rnE "amber-[0-9]|emerald-[0-9]|sky-[0-9]|violet-[0-9]|stone-[0-9]|#6a5a3a|zinc-[0-9]|stone-[0-9]|#fbbf24|#c5b08a|#2a2418|ca-(bg|surface|border|body|muted|text)" src/`
Expected: no matches (all migrated). Fix any stragglers.

- [ ] **Step 2: Full suites + build**

Run: `npm test` → PASS 106. Run: `npx playwright test` → PASS 17. Run: `npm run build` → succeeds.

- [ ] **Step 3: Prod-bundle leak check (fixtures must not ship)**

Run: `grep -r "clone_plants_v1\|e2e-fixtures\|seed" dist/ ; echo "exit=$?"`
Expected: `exit=1` (no matches) — confirms the env-gated mock layer still tree-shakes out.

- [ ] **Step 4: Manual visual pass**

Run the dev server, check each tab on a mobile viewport (iPhone) for: glass nav, large titles, grouped lists, blue accents, sheet behavior, safe-area insets.

- [ ] **Step 5: Final commit (if cleanup needed) & report**

```bash
git commit -am "chore: Graphite Glass final cleanup"
```

Report branch status; ask user before any `main` merge/push (auto-deploys via Vercel).

---

## Self-Review

- **Spec coverage:** tokens (T1) ✓, font swap (T1) ✓, style constants (T2) ✓, sheets + grouped lists + segmented (T3) ✓, tab bar + large title (T4) ✓, all 6 tabs + MotherDetail (T4–T10) ✓, charts (T8) ✓, testing strategy / testid + label preservation (every task + T11) ✓, prod-leak guard (T11) ✓, branch/no-main constraint (Global + T11) ✓.
- **Placeholder scan:** token values, class strings, and commands are concrete; per-tab tasks specify exact files + the migration mapping rather than inventing full unread file bodies (honest, since the change is a class sweep over existing markup driven by impeccable).
- **Type/name consistency:** `inputCls`, `selectCls`, `btnPrimary`, `btnSecondary`, `Modal`, `Badge`, `StatBox`, `GroupedList`, `GroupedRow`, `SegmentedControl` names used consistently T2→T10. Tailwind namespace `ag` used consistently. `data-testid="tab-nav"` referenced from the verified line `src/App.jsx:768`.

---

## Addendum — touch-ups from /btw scan (2026-06-23)

### Task 4B: Extended palette tokens + shared-constant leftovers (run after Task 4, before tab sweeps)

The domain encodes meaning in color beyond the 5 base semantics. Add Apple system colors so per-type colors map cleanly instead of being flattened/ad-hoc'd by the tab sweeps.

- **`src/index.css` `:root`** — add: `--purple: #bf5af2; --teal: #40c8e0; --indigo: #5e5ce6; --gray: rgba(235,235,245,0.3);`
- **`tailwind.config.js` `ag`** — mirror: `purple:"#bf5af2", teal:"#40c8e0", indigo:"#5e5ce6", gray:"rgba(235,235,245,0.3)"`.
- **`TYPE_META` (shared.jsx ~97–118)** — migrate per-log-type colors to the new palette: transplant→`#0a84ff` (blue), amendment→`#bf5af2` (purple), feeding→`#30d158` (green), clone→`white/30` (gray), reduction→`#ff453a` (red). Keep the object shape/keys identical.
- **`HealthDots` (shared.jsx ~342, ~356)** — `bg-emerald-400`→`bg-[#30d158]`, `text-sky-300`→`text-[#0a84ff]` (or token equivalents). No logic change.
- Test: `npm test` → 106; commit `feat: extended Apple palette + TYPE_META/HealthDots migration`.

### Fold-ins (not separate tasks)

- **Task 4 (tab bar/header):** also migrate the pre-auth loading splash (`App.jsx` ~682–695) — amber chip/spinner → tokens; drop `shadow-amber-950/*` tinted glow (Apple dark avoids colored glows; use neutral/none).
- **Task 7 (Dry Room):** extract the verbatim-duplicated "LOWERS" badge (4×: lines ~304/563/639/969) and rackType badge (2×) into small components, then swap colors once. `RoomTab.jsx:132` bulk button `bg-violet-900/60` → `#bf5af2` tint.
