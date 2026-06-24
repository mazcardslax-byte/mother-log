# Graphite Glass — Apple Dark-Glass Redesign

## Goal

Move mother-log from the current **Carbon Amber** dark/gold theme to a modern,
cutting-edge **Apple-style "Graphite Glass"** look: deep charcoal surfaces,
frosted-glass (vibrancy) navigation and sheets, SF-style typography, the iOS
grouped-inset list pattern, and Apple system-blue accents. The app is a
mobile-first PWA used in a dim grow room, so the dark base is both on-brand for
Apple's Pro aesthetic and practical for the environment.

This is a **restyle, not a behavior change.** All data flows, Supabase calls,
and logic stay untouched. The full Phase 0 test suite (106 Vitest + 17
Playwright) must remain green throughout.

## Decisions (locked in brainstorming)

- **Look:** Dark glass (Apple Pro) — not light, not adaptive.
- **Accent:** Apple system blue `#0A84FF`.
- **Rollout:** All 6 tabs in one sweep (shared primitives first, then each tab).
- **Typography:** Replace DM Sans with the system font stack so it renders as
  real SF Pro on the user's iPhone.

## Current state (baseline)

- Theme defined in `src/index.css` under `:root` as "Carbon Amber Design Tokens"
  (`--color-bg: #0a0a0a`, amber accents `#fbbf24`, body text warm gold, DM Sans).
- UI primitives live in `src/shared.jsx`; tabs are `App.jsx`, `ClonesTab.jsx`,
  `DryRoomTab.jsx`, `FacilityTab.jsx`, `RoomTab.jsx`, `StatsTab.jsx`, plus
  `MotherDetail.jsx`. Color usage is Tailwind `amber-*` / `zinc-*` classes
  alongside the CSS variables.
- `tailwind.config.js` + Tailwind utilities. Existing helpers: `.press-card`
  press-scale, `.pt-safe` safe-area header padding, scrollbar hiding.

## Design tokens — "Graphite Glass"

Defined in `src/index.css` `:root`, mirrored into `tailwind.config.js` theme
where Tailwind classes are used.

### Surfaces (elevation via surface, not heavy shadow — the iOS way)

| Token         | Value                    | Use                                                                                   |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `--bg`        | `#000000`                | True-black base background                                                            |
| `--surface-1` | `#1C1C1E`                | Cards, grouped-list containers                                                        |
| `--surface-2` | `#2C2C2E`                | Raised elements within cards                                                          |
| `--glass`     | `rgba(28,28,30,0.72)`    | Nav bar, headers-on-scroll, sheets — paired with `backdrop-blur(20px) saturate(180%)` |
| `--separator` | `rgba(255,255,255,0.08)` | 1px hairline dividers/borders                                                         |

### Accent + semantic (Apple dark-mode system colors)

| Token      | Value                   |
| ---------- | ----------------------- |
| `--accent` | `#0A84FF` (system blue) |
| `--green`  | `#30D158`               |
| `--red`    | `#FF453A`               |
| `--orange` | `#FF9F0A`               |
| `--yellow` | `#FFD60A`               |

### Text (Apple label hierarchy)

| Token              | Value                    |
| ------------------ | ------------------------ |
| `--text-primary`   | `rgba(255,255,255,0.92)` |
| `--text-secondary` | `rgba(235,235,245,0.6)`  |
| `--text-tertiary`  | `rgba(235,235,245,0.3)`  |

### Typography

- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif`. Drop the Google Fonts DM Sans import.
- Scale (Apple): Large Title 34/bold, Title 22/bold, Headline 17/semibold,
  Body 17/regular, Subhead 15, Footnote 13, Caption 12. Tight letter-spacing on
  large titles.

### Radius / spacing / motion

- Radius: cards 14px, buttons 12px, sheets 20px (top corners), pills full.
- Margins: 16px screen gutters; grouped-list inset style.
- Shadows: minimal/low-opacity; rely on surface elevation.
- Motion: 200–280ms ease-out; card press-scale (reuse `.press-card`); sheets
  spring slide-up. Restrained — never cartoonish.

## Component patterns

### Navigation

- **Bottom tab bar:** frosted `--glass` background, hairline top border, blue
  active icon/label (filled SF-style glyph) + gray inactive. **Must keep
  `data-testid="tab-nav"` and the exact tab labels** (Phase 0 e2e `openTab` is
  scoped to that testid with `exact: true`).
- **Headers:** iOS large-title — large at rest, collapses to a centered inline
  title behind a frosted blur bar once scrolled.

### Lists & cards

- **Grouped inset cards:** rounded `--surface-1` container, rows split by
  hairline separators, right-aligned chevrons/values (iOS Settings pattern).
  Backbone for Mothers, Facility, detail rows.
- **Content cards:** `--surface-1`, 14px radius, hairline border, generous
  padding.

### Controls

- **Primary button:** filled blue, 12px radius, semibold, `:active` press-scale.
- **Secondary/tinted:** blue text on 10%-blue fill.
- **Segmented control:** Apple pill segmented look for in-tab switches.
- **Badges/pills:** tinted semantic colors (Active = green tint, Sidelined =
  gray, etc.).

### Sheets & modals

- Quick-log hub and `MotherDetail` become **bottom sheets**: frosted, 20px top
  radius, grabber handle, slide-up spring. Replaces centered modals. Hub labels
  stay **Transplant / Clone / Reduce / Amendment**.

### Charts (Stats)

- Apple Health style: thin blue/green strokes, hairline gridlines, no heavy
  fills.

## Per-tab application

All tabs consume the shared primitives (`shared.jsx`) and tokens (`index.css`):

- **Mothers (`App.jsx` / mother cards):** cards → grouped inset; detail → sheet.
- **Clones (`ClonesTab.jsx`):** cards/badges restyled.
- **Dry Room (`DryRoomTab.jsx`):** cards/badges restyled.
- **Stats (`StatsTab.jsx`):** chart + metric cards restyled.
- **Facility (`FacilityTab.jsx`):** grouped inset lists.
- **Add (`RoomTab.jsx` / add form):** grouped inset **form** rows.
- **`MotherDetail.jsx`:** bottom sheet treatment.

## Testing strategy

- This is a restyle — **no logic changes.** All 106 Vitest unit tests stay
  green unchanged.
- All 17 Playwright e2e tests stay green: preserve every `data-testid`, the
  exact tab labels, and the quick-log hub labels. Run e2e against the mocked
  local dev server (`VITE_E2E_MOCK=1`) after each tab.
- Manual visual check on mobile viewport per tab.

## Constraints & conventions (must honor)

- Mobile-first PWA; preserve safe-area insets (`.pt-safe`, notch handling).
- Keep `data-testid` attributes and exact user-facing labels intact.
- Tailwind + CSS-variable approach as today; extend, don't rip out the build.
- Auto-deploy: work stays on `feature/graphite-glass-apple`; do not push `main`
  without explicit confirmation (Vercel auto-deploys main).

## Out of scope

- New features or behavior changes.
- Light / adaptive theme (dark-only for now).
- React 19 / dependency upgrades (that's a later modernization phase).
- Chart library swap (restyle the existing chart, don't replace it).

## Next step

Hand off to the writing-plans skill for a detailed, tab-by-tab implementation
plan; execute the reskin through the **impeccable** skill (with **ui-ux-pro-max**
for design-system intelligence).
