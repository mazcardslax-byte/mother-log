# Dry Room Tab — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Scope:** New Dry Room tab with Hanging, Archive, and Bins (stub) sub-tabs

---

## Overview

Add a dedicated **Dry Room** tab (7th tab in bottom nav, between Stats and Clones) for tracking harvested flower hanging on drying racks. Data is fully independent from mother/clone data. Supabase key `dryroom` stores active batches, archive, and a bins placeholder for a future feature.

---

## Concepts

### Batch
A single strain tag hung on a rack. One rack can hold multiple batches simultaneously. Racks have no identity beyond their type (main or side) — the data lives on the batch.

### Quality Tiers
- **Tops** — top-quality flower (explicit label)
- **Mid** — middle quality (no label, neutral display)
- **Lowers** — lower quality (explicit label)

### Rack Types
- **Main** — full-size rack. 22 fixed racks in the room.
- **Side** — smaller rack (~half size of main). Up to 12 side racks, added/removed as needed.

### Drying Window
15 days from hang date. Flower must be binned on or before day 15.

---

## Data Model

### Active batch
```js
{
  id: string,          // uuid
  strainCode: string,  // e.g. "2013"
  quality: "tops" | "mid" | "lowers",
  rackType: "main" | "side",
  dateHung: string,    // ISO date e.g. "2026-03-31"
  note: string,        // optional, may be empty string
}
```

### Archived batch
Same shape as active batch plus:
```js
{
  ...batch,
  dateBinned: string,  // ISO date
}
```

### Supabase storage
Key: `dryroom`
```js
{
  active: BatchRecord[],
  archive: ArchivedBatchRecord[],
  bins: [],  // reserved for future Bins feature — do not use yet
}
```

Local storage cache key: `dryroom` (same pattern as ClonesTab).

---

## Sub-tabs

`Hanging · Archive · Bins`

---

## Feature 1 — Hanging Tab

### Header bar
- `X batches hanging · Y main · Z side`
- If any batch is overdue (days remaining ≤ 0): `· X overdue` in red
- `+ Add Batch` button (top right)

### Batch list
Sorted by days remaining ascending (most urgent first).

**Each card:**
- Strain name (large) + strain code (small, muted)
- Quality badge: `TOPS` (emerald) · `LOWERS` (amber) · mid = no badge
- Rack type pill: `Main` or `Side`
- Date hung + days hanging count
- Days remaining countdown, color-coded:
  - > 7 days remaining → green
  - 4–7 days remaining → amber
  - 1–3 days remaining → red/orange
  - ≤ 0 days remaining → red + `OVERDUE` label
- Optional note (shown if present)
- **Bin It** button — confirmation prompt, then moves batch to archive with today as `dateBinned`

### Empty state
"Nothing hanging right now. Tap + Add Batch to log today's harvest."

### Add Batch form (modal/sheet)
Fields:
1. **Strain** — scrollable picker from STRAINS list (same list used in App.jsx)
2. **Quality** — 3-button toggle: `Tops` / `Mid` / `Lowers`
3. **Rack type** — 2-button toggle: `Main` / `Side`
4. **Date hung** — date input, defaults to today
5. **Note** — optional text field

---

## Feature 2 — Archive Tab

Read-only history of all binned batches.

- Listed newest first (by `dateBinned`)
- Search/filter by strain name
- Each row: strain name, quality badge, rack type pill, date hung → date binned, total days dried
- No editing or deletion

---

## Feature 3 — Bins Tab (stub)

Placeholder only. Renders an empty state card:

> "Bin tracking coming soon."

Data key `bins: []` is reserved in the Supabase structure. No UI logic beyond the stub.

---

## Technical Notes

### New file
`src/DryRoomTab.jsx` — self-contained component, same pattern as `ClonesTab.jsx`. Owns its own Supabase load/save/subscribe logic under key `dryroom`.

### STRAINS list
Import or duplicate the STRAINS constant from App.jsx. No need to centralize yet — consistent with existing ClonesTab pattern.

### Tab registration
Add to `TAB_ITEMS` in `App.jsx`:
```js
{ key: "DryRoom", label: "Dry Room", icon: Wind }
```
Position: between Stats and Clones. Import `Wind` from lucide-react.

### Days calculations
```js
function daysHanging(dateHung) {
  const hung = new Date(dateHung);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  hung.setHours(0, 0, 0, 0);
  return Math.floor((today - hung) / (1000 * 60 * 60 * 24));
}
function daysRemaining(dateHung) {
  return 15 - daysHanging(dateHung);
}
```

### No schema changes
Mothers, clones, strains, facility data are untouched.

---

## What is NOT changing

- No changes to existing tabs (Summary, Mothers, Room, Facility, Stats, Clones)
- No changes to mothers/strains data model
- No Supabase schema migrations (JSON blob store)

---

## Testing Checklist

- [ ] Add batch form saves correctly to Supabase
- [ ] Batch list sorted most urgent first
- [ ] Days remaining color coding correct at each threshold
- [ ] OVERDUE label appears on day 15+
- [ ] Bin It confirmation prompt appears before archiving
- [ ] Archived batch appears in Archive tab with correct dateBinned
- [ ] Archive search/filter works
- [ ] Header counts (total, main, side, overdue) accurate
- [ ] Bins tab renders stub correctly
- [ ] Empty state shown when no active batches
- [ ] Works offline (localStorage cache)
- [ ] No crashes when active/archive arrays are empty
- [ ] Existing tabs unaffected
- [ ] Deployed to Vercel without build errors
