---
name: Mother Log
description: Internal grow-room management tool for Stacks Family Farms — track mothers, rooms, harvests, and clones in the field.
colors:
  bg: "#000000"
  surface-1: "#1c1c1e"
  surface-2: "#2c2c2e"
  glass: "#1c1c1eb8"
  separator: "#ffffff14"
  signal-blue: "#0a84ff"
  vitality-green: "#30d158"
  caution-amber: "#ffd60a"
  alert-red: "#ff453a"
  orange: "#ff9f0a"
  purple: "#bf5af2"
  teal: "#40c8e0"
  indigo: "#5e5ce6"
  text-primary: "#ffffffeb"
  text-secondary: "#ebebf599"
  text-tertiary: "#ebebf54d"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "normal"
  data:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
rounded:
  cell: "8px"
  action: "12px"
  card: "16px"
  modal: "20px 20px 0 0"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.action}"
    padding: "12px 16px"
    height: "44px"
  button-primary-active:
    backgroundColor: "#0a6fd6"
    textColor: "#ffffff"
    rounded: "{rounded.action}"
    padding: "12px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.action}"
    padding: "12px 16px"
    height: "44px"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.alert-red}"
    rounded: "{rounded.action}"
    padding: "12px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.action}"
    padding: "12px 14px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.card}"
    padding: "16px"
  segmented-control:
    backgroundColor: "#ffffff0f"
    rounded: "10px"
    padding: "2px"
  segmented-control-active:
    backgroundColor: "{colors.signal-blue}"
    textColor: "#ffffff"
    rounded: "8px"
---

# Design System: Mother Log

## 1. Overview

**Creative North Star: "The Field Instrument"**

Mother Log is built like a field instrument — not a screen you admire, but a tool you grip. Somewhere between a weather station display and a grow-room clipboard, it reads at a glance, responds without ceremony, and gets out of the way the moment you have what you need. The design premise is a person with soil on their gloves reading this on a phone in a dark room at 6am. Every decision answers to that premise.

The visual language is iOS dark-native, not dark-mode: surfaces are built from black up (#000 → #1c1c1e → #2c2c2e) rather than inverted from a light system. Depth is tonal, not shadow-based. Semantic color carries all health, status, and alert meaning — Signal Blue for primary actions, Vitality Green for good health, Caution Amber for watch states, Alert Red for poor or destructive. Color is not decoration here; it is data.

Typography is a single system-native stack (SF Pro / system-ui). No display typefaces, no pairing. The hierarchy is communicated through weight and size alone — bold data labels at 10–11px in grid cells, semibold 14–16px for primary text, regular muted text for supporting context. Density is a feature, not a compromise.

**Key Characteristics:**

- Dark-native, never dark-mode-inverted
- Semantic color as data, not as decoration
- Single-family type at controlled weights
- All touch targets ≥ 44px minimum
- Tonal elevation, no drop shadows
- Bottom-sheet modal pattern throughout (never centered dialogs)
- Information density appropriate to a field tool — not sparse, not cluttered

## 2. Colors: The Clinical Palette

Ten semantic tokens, one neutral layer, zero decorative color. Every hue carries a specific meaning and appears only in that role.

### Primary

- **Signal Blue** (#0a84ff): The single action color. Used exclusively on primary buttons, active tab indicators, planted square cells, and selected states. Never used as decoration or for category coding.

### Secondary

- **Vitality Green** (#30d158): Health state — excellent/good mothers, green pots, positive outcomes. Used with /15 alpha for backgrounds, /40 for borders, solid for text/icons.
- **Purple** (#bf5af2): Amendment actions. Used for the amend button and amendment-related UI only.
- **Teal** (#40c8e0): Secondary metadata (bench labels). Rarely used; one step removed from primary.

### Tertiary

- **Caution Amber** (#ffd60a): Health state — moderate. Also used for perimeter/tester indicators in grow-room grids and warning-level states.
- **Alert Red** (#ff453a): Health state — poor. Also used for destructive action confirmation states (never the button default, only the active/confirm state).
- **Orange** (#ff9f0a): Rare health edge case, timer warnings. Appears less than once per screen.
- **Indigo** (#5e5ce6): Upcoming-round slot markers in the veg room grid. One specific purpose, never reused.

### Neutral

- **Void** (#000000): Body background. The floor everything is built on.
- **Graphite Surface** (#1c1c1e): Cards, containers, modal sheets, stat boxes. The first elevation step.
- **Nested Graphite** (#2c2c2e): Inputs, dropdowns, inline forms, nested containers. The second elevation step.
- **Glass** (rgba 28/28/30 at 72% — #1c1c1eb8): Header bar and overlays that need backdrop blur. Never used for content containers.
- **Separator** (rgba 255/255/255 at 8% — #ffffff14): Borders, dividers, horizontal rules. The only border color in the system.
- **Text Primary** (rgba 255/255/255 at 92%): All primary text. Not pure white — the 8% rolloff reads softer at mobile DPI.
- **Text Secondary** (rgba 235/235/245 at 60%): Supporting labels, sub-labels, metadata.
- **Text Tertiary** (rgba 235/235/245 at 30%): Placeholder text, empty-state hints, legend items.

### Named Rules

**The One Role Rule.** Each semantic color maps to exactly one meaning system-wide. Signal Blue = primary action. Vitality Green = good health / green pots. Never use Vitality Green to mean "confirmed" or Signal Blue to mean "healthy." If a new screen breaks the mapping, rethink the screen, not the mapping.

**The Alpha Protocol.** Semantic colors appear in three forms only: `color/15` for backgrounds, `color/40` for borders, `color` solid for text and icons. Do not invent intermediate opacities. The three-stop system keeps all health-coded surfaces immediately recognizable.

## 3. Typography

**System Font:** -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif

**Character:** One family, everywhere. SF Pro at the OS level gives this tool its native feel on the devices the team actually uses (iPhone). There is no display face, no pairing, no headline treatment. Weight and size carry all hierarchy.

### Hierarchy

- **Display** (700 weight, 18–24px): Modal titles, tab section headings. Never on a content page.
- **Title** (700 weight, 14–16px): Strain codes, card primary labels, stat values. Bold is the emphasis signal, not size.
- **Body** (400 weight, 14px, line-height 1.4): General content, log entry text. Minimal prose — this is not a reading interface.
- **Label** (600 weight, 12px): Button text, form labels, section headers inside modals.
- **Data** (700 weight, 9–11px, line-height 1): Grid cell content, badge text, dense status indicators. Fixed at small sizes — never scales.
- **Muted Label** (400 weight, 10px, uppercase tracked): Used sparingly for legend items and bed labels. Not every section — only where spatial location needs a soft marker.

### Named Rules

**The No-Clamp Rule.** All type sizes are fixed px values, never fluid clamp(). The app targets mobile at a consistent DPI; fluid headings solve a problem this tool doesn't have and add visual instability.

**The Weight Ceiling Rule.** Maximum weight is 700 (font-bold). `font-black` (900) is never used. The design is dense enough — weight beyond 700 competes with semantic color for attention.

## 4. Elevation

This system uses **tonal layering, not shadows.** Depth is conveyed by surface steps, not by drop shadows. There are no box-shadows on cards, modals, buttons, or any content container.

Three tonal levels:

- **Level 0 — Void** (#000000): The page body. Nothing lives here directly; it is the gap between surfaces.
- **Level 1 — Graphite Surface** (#1c1c1e): Cards, stat boxes, containers, modals, the bottom nav.
- **Level 2 — Nested Graphite** (#2c2c2e): Inputs, inline search/autocomplete dropdowns, nested list items, amendment forms.

The modal sheet (Level 1 surface sliding up from the bottom) is the one place elevation changes on state — `translateY(100%) → translateY(0)` at 150ms ease-out, conveying arrival, not floating. It is the only z-axis motion in the system.

### Named Rules

**The No-Shadow Rule.** Drop shadows are prohibited. If a container needs to read as "above" another, step up the surface token. If there is no surface token at the right level, the hierarchy is wrong — rethink it.

**The Glass Exception.** `backdrop-filter: blur(20px)` on the header bar only. Glass effects are never used for content containers, modals, or cards. The single use case is the fixed header sitting above scrollable content, where the subtle blur communicates positional layering without a hard surface edge.

## 5. Components

### Buttons

Tactile and decisive. A button press should feel like physical confirmation — the `press-card` class applies `scale(0.985) opacity(0.85)` at 150ms ease-out on `:active`.

- **Shape:** Gently rounded (12px radius, `rounded-xl`). Not pill, not square.
- **Primary:** Signal Blue (#0a84ff) fill, white text, 16px left/right padding, 12px vertical, min-height 44px. Active state darkens to #0a6fd6.
- **Disabled:** Primary button at 40% opacity. No cursor change needed on mobile.
- **Secondary / Ghost:** Border border-white/10, text at 60% white. Same radius and size. Active: border and text lighten toward full white.
- **Destructive (confirm state only):** Border and text shift to Alert Red (#ff453a) at opacity/40 border, solid text. Never used as the default state — destructive color appears only after a tap.
- **Sizing rule:** All buttons minimum 44px height. Full-width (`w-full`) in modals and action sheets.

### Segmented Control

- **Container:** bg rgba(255,255,255,0.06), 10px radius, 2px internal padding.
- **Inactive segment:** Text at 60% white, no background.
- **Active segment:** Signal Blue (#0a84ff) fill, white text, 8px radius. The active state slides — do not hard-cut.

### Cards / Containers

- **Corner Style:** Generously rounded (16px, `rounded-2xl`).
- **Background:** Graphite Surface (#1c1c1e) always. Never Surface-2 (#2c2c2e) for a top-level card.
- **Shadow Strategy:** None. See Elevation.
- **Border:** Separator (rgba white 8%) on all four sides. Never a colored border at card level — colored borders are reserved for health-coded grid cells.
- **Internal Padding:** 16px (`p-4`).

### Inputs / Selects

- **Style:** Surface-1 (#1c1c1e) background, Separator border on all sides, 12px radius.
- **Focus:** Border shifts from Separator to rgba(255,255,255,0.3) — subtle brightening, no glow ring.
- **Text:** Text Primary at 90% white.
- **Placeholder:** Text Tertiary (rgba 235/235/245 at 30%) — passes 4.5:1 contrast against Surface-1.
- **Full width** in all form contexts.

### Navigation (Tab Bar)

- **Position:** Fixed bottom, full width, bg Void (#000) with top separator border.
- **Safe area:** Respects `env(safe-area-inset-bottom)` — never clips on notched iPhones.
- **Tabs:** Icon (20px) + label (10px), stacked. Active: Signal Blue icon + text. Inactive: Text Tertiary (30% white).
- **Touch target:** Each tab cell extends to the full safe-area height, ≥ 44px.

### Grid Cells (Grow Room Squares)

Signature component — the primary data surface in Room and Grow Rooms tabs.

- **Shape:** Square aspect ratio, 8px radius (`rounded-lg`), `gap-1` between cells in a 7-column grid.
- **Empty state:** Dashed border-white/15, "+" label in Text Tertiary. Perimeter cells: dashed border-amber/25, faint amber tint bg.
- **Planted state:** Signal Blue border (/30) and bg (/10), strain code in Signal Blue (bold, 10px), pot color dot (5px, Vitality Green or #636366 for black pot), plant count in Text Tertiary (8px).
- **Tester badge:** Absolute top-right, 7px bold Caution Amber, "T{n}" format.
- **Health cells (veg room):** Full health-color scheme — green/yellow/red bg tints, health dots below strain code.
- **Tap target:** The cell itself; no separate edit button.

### Bottom Sheet Modal

- **Shape:** `rounded-t-[20px]` — rounds only the top two corners.
- **Background:** Graphite Surface (#1c1c1e).
- **Overlay:** Void (#000) at ~60% opacity, tapping it closes the sheet.
- **Drag handle:** 4×36px pill, separator color, centered at top, 8px below the edge.
- **Animation:** `translateY(100%) → translateY(0)` at 150ms ease-out. Reduced-motion: instant.
- **Header:** Title (semibold, 17px) left-aligned, × close button right-aligned, separator below.
- **Body padding:** 16px horizontal, 20px bottom safe-area gap.
- **Use case:** Every contextual detail view — spot sheets, mother detail, quick-log actions. Never a centered dialog.

### Health Dots

Five 4px dots in a horizontal row. Filled to the health level in the level's semantic color (green ≥ 4, yellow = 3, red ≤ 2), unfilled dots at white/15.

### Badge / Chip

- **Shape:** Rounded-full, `text-[13px]`, `px-2 py-0.5`.
- **Color:** Semantic fill — pass the color class directly (`bg-green/15 text-green border-green/40`).
- **Use:** Status labels (Active, Sidelined, Done), strain category markers.

## 6. Do's and Don'ts

### Do:

- **Do** keep all touch targets ≥ 44px height. Test on actual device, not browser DevTools.
- **Do** use the three-stop alpha protocol for semantic colors: `/15` background, `/40` border, solid text.
- **Do** open contextual detail in a bottom-sheet modal. Always. Not a new page, not a centered dialog.
- **Do** use tonal surface stepping for depth (#000 → #1c1c1e → #2c2c2e). If a new surface level is needed, it doesn't exist — rethink the layout.
- **Do** keep the tab bar at the bottom and respect safe-area insets on all screens.
- **Do** use `press-card` (scale 0.985, opacity 0.85) on card-buttons and list rows so tap feedback is immediate.
- **Do** add `prefers-reduced-motion` alternatives to every CSS animation. The modal slideUp becomes instant; press-card becomes opacity-only.

### Don't:

- **Don't** use drop shadows on any surface. Not `box-shadow`, not `filter: drop-shadow`. See The No-Shadow Rule.
- **Don't** use Signal Blue (#0a84ff) as a category color, decoration, or highlight. It means "primary action" and nothing else. Using it elsewhere erodes the one-signal contract.
- **Don't** design this like a SaaS dashboard (Notion, Linear, startup blue-on-white). No sidebar navigation, no card-grid scaffolding, no hero metrics. This is a field tool, not a product page.
- **Don't** design this like a dispensary POS or retail inventory app. No product tiles, price displays, or customer-facing shopping patterns.
- **Don't** use colored `border-left` or `border-right` stripes greater than 1px as card accents. Color belongs in the background tint, not in a side stripe.
- **Don't** use gradient text (`background-clip: text` + gradient). Single solid semantic color only.
- **Don't** use glassmorphism on content containers. Glass is reserved for the fixed header bar only.
- **Don't** use `font-black` (weight 900). Hard cap at `font-bold` (700).
- **Don't** add uppercase tracked eyebrows to every section heading. One deliberate muted label per layout zone maximum.
- **Don't** invent a new semantic color for a new feature. Map to the existing vocabulary or make the feature fit the vocabulary.
