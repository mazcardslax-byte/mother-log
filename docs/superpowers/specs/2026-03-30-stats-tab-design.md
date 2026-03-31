# Stats Tab — Analytics & Reporting

**Date:** 2026-03-30
**Status:** Approved
**Scope:** New Stats tab with clone rooting rates, health trends, strain comparison, and care gaps

---

## Overview

Add a dedicated **Stats** tab (6th tab in bottom nav) containing four analytics sections. Uses `recharts` for charts. No backend changes — all data derived from existing mother objects in state.

---

## Feature A — Clone Rooting Rates

**Summary row:** Three stat boxes — Overall rooting rate %, Total cuts taken, Total rooted.

**Bar chart by strain:** Horizontal bars, one per strain, showing rooting rate %. Color-coded:
- ≥75% → emerald (`#10b981`)
- ≥50% → amber (`#f59e0b`)
- <50% → red (`#ef4444`)

**Data source:** Aggregate `mother.cloneLog` entries across all mothers. Each entry has `outcome: 'rooted' | 'failed' | null`. Only entries with a non-null outcome count toward the rate. Group by `getStrain(mother.strainCode).name`.

---

## Feature B — Health Trends

**Plant picker:** Dropdown listing all active mothers (label: `strainName — location`). Defaults to first active mother.

**Line chart:** `recharts` LineChart, Y-axis 1–5, X-axis dates. Plots `mother.healthLog` entries sorted by date ascending.

**Data schema change:** Add `healthLog: []` to `defaultMother()`. Each entry: `{ date: string (ISO), level: number (1–5) }`. When `updateMother(id, { healthLevel })` is called and the level differs from current, append to `healthLog`. Seed with one entry at the current health level on first render for any mother missing a log.

**Empty state:** "Health trend starts recording from today — check back after a few updates."

---

## Feature C — Strain Comparison Table

**Columns:** Strain | Avg Health | Total Clones | Rooting Rate | Avg Veg Days

**Sorting:** Default sorted by Avg Health descending. Tap column header to re-sort.

**Color coding:** Avg Health and Rooting Rate use same thresholds as Feature A bar chart.

**Data source:** Aggregate across all mothers grouped by `strainCode`.

---

## Feature D — Care Gaps (simple)

**List:** All active mothers sorted by `daysSince(lastFeedingDate(m.feedingLog))` descending (most neglected first).

**Each row:** Strain + location | Last watered date | Days count (color-coded using existing `feedingDaysColor()` thresholds).

**No new state.** Entirely derived from existing `feedingLog` data.

---

## Implementation Notes

### New dependency
```
npm install recharts
```

### Data migration for healthLog
`defaultMother()` gains `healthLog: []`. Existing mothers loaded from Supabase won't have this field — treat missing `healthLog` as `[]` everywhere and seed on first load.

### updateMother health tracking
In the `updateMother` callback, when the patch contains `healthLevel` and it differs from the current value, also append to `healthLog`:
```js
if (patch.healthLevel !== undefined && patch.healthLevel !== m.healthLevel) {
  patch = { ...patch, healthLog: [...(m.healthLog ?? []), { date: today(), level: patch.healthLevel }] };
}
```

### Tab nav
Add Stats tab between Facility and Clones in the bottom nav. Icon: `BarChart2` from lucide-react.

### File structure
Stats tab implemented as a `StatsTab` component in `App.jsx` (consistent with existing pattern of all components in one file).

---

## What is NOT changing

- No changes to Supabase schema (still key-value JSON store)
- No changes to existing Summary tab
- No changes to mother card, room grid, or facility tab
- No file splitting

---

## Testing checklist

- [ ] Clone rooting rate % matches manual calculation from seed data
- [ ] Bar chart renders correctly on mobile (320px wide)
- [ ] Health trend line chart renders empty state for new mothers with no log
- [ ] Health trend updates when health level is changed in mother detail modal
- [ ] Strain comparison table sorts correctly by each column
- [ ] Care gaps list sorted correctly, most neglected first
- [ ] Stats tab nav item highlights when active
- [ ] No crashes when mothers array is empty
- [ ] Existing tabs unaffected
- [ ] Deployed to Vercel without build errors
