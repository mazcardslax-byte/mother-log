# Bins Tab Design

**Date:** 2026-04-01
**Status:** Approved
**Feature:** Bins panel — tote inventory tracking inside the Dry Room tab

---

## Overview

Bins are filled with dried flower taken off racks. After filling, each bin goes through a 14-day burp period (daily burping required, days count toward total cure time), then continues curing until sent downstairs to the trim team. The archive groups bins by manually-defined harvest (date range).

---

## Data Model

Two new arrays added to the existing `dryroom` Supabase key alongside `active` and `archive`:

### Bin object

```js
{
  id: uid(),
  strainCode: "2003",         // inherited from source rack
  quality: "lowers",          // inherited from source rack ("tops" | "lowers")
  dateHung: "2026-03-31",     // the source rack's original hang date
  fillDate: "2026-04-01",     // date this bin was filled
  size: "full" | "half",      // full tote (default) or half tote
  burps: ["2026-04-02", ...], // array of ISO date strings, one entry per burp event
  harvestId: null,            // set when sent downstairs; references a harvest id
  dateSent: null,             // ISO date string; set when sent downstairs
}
```

### Harvest object

```js
{
  id: uid(),
  name: "Spring Run",         // optional user-defined label; falls back to date range display
  startDate: "2026-03-27",    // ISO date string
  endDate: "2026-04-01",      // ISO date string
}
```

### Derived status (not stored)

| Condition | Status |
|-----------|--------|
| `harvestId` is set | `archived` |
| days since `fillDate` ≤ 14 | `burping` |
| days since `fillDate` > 14 | `curing` |

### Storage

No new Supabase key needed. `bins: []` is already reserved in the `dryroom` key. Add `harvests: []` alongside it.

Final shape:
```js
{
  active: [...],    // dry room racks (existing)
  archive: [...],   // archived racks (existing)
  bins: [],         // NEW
  harvests: [],     // NEW
}
```

---

## UI/UX Flow

### Active view — two sections

**Burping (days 1–14):**
- Bin card shows: strain name, quality badge, size (full/half), fill date, days cured count
- "Burp Today" button — tapping logs today's ISO date to `burps[]`
- If already burped today → button replaced with green checkmark (disabled)
- If yesterday's date is absent from `burps[]` → red "Missed" badge on card
- Burp progress: row of 14 dots — filled = burped that day, empty = not yet or missed

**Curing (day 15+):**
- Same card layout, no burp button
- Shows total days cured count and strain info
- No missed-burp indicator (burp period is complete)

### Add Bin — modal

1. Tap `+ Add Bin`
2. Dropdown: pick source rack from dry room archive (label format: `{strainName} {quality} {dateHung}`, e.g., "Garlic Ice Mintz lowers 3/31")
3. Strain, quality, and dateHung auto-fill from selected rack — read-only
4. Size toggle: **Full** (default) | **Half**
5. Fill date: defaults to today, editable
6. Confirm → bin created, appears in Burping section immediately

### Send Downstairs — modal

1. Tap "Send Downstairs" on any active bin card
2. Existing harvests listed (most recent first); if a harvest's date range overlaps the bin's `dateHung`, it is highlighted as a suggested match
3. "New harvest" option: optional name + start date + end date
4. Confirm → `harvestId` and `dateSent` set on bin; bin moves to archive

### Archive view

- Harvest cards, collapsed by default
- Each harvest card shows: name (or date range if unnamed), bin count, comma-separated strain summary
- Tap to expand → individual bin rows: strain, quality, size, total days cured when sent

---

## Components

All within `DryRoomTab.jsx`, replacing the existing `BinsPanel` placeholder.

| Component | Responsibility |
|-----------|---------------|
| `BinsPanel` | Top-level; reads/writes bins and harvests from dryroom state |
| `BinCard` | Single bin display; burp button, missed badge, send downstairs trigger |
| `BurpDots` | 14-dot progress row; pure display, no state |
| `AddBinModal` | Rack picker dropdown, size toggle, fill date input |
| `SendDownstairsModal` | Harvest picker, new harvest inline form |
| `HarvestCard` | Archive group; collapsible, shows bin list when expanded |

---

## Logic (dry-room-utils.js)

Two new utility functions, consistent with existing `daysHanging`, `daysRemaining` pattern:

```js
// Returns "burping" | "curing" | "archived"
getBinStatus(bin)

// Returns integer days from fillDate to today (or dateSent if archived)
getDaysCured(bin)
```

---

## Edge Cases

- **Missed burp on day 1:** Fill date = today, so no yesterday to miss. No missed badge shown until day 2.
- **Multiple bins from same rack:** Rack stays in dry room archive regardless of how many bins are created from it. Bins are independent entries.
- **Half tote:** Treated identically to full tote except the size badge on the card. No downstream logic difference.
- **Harvest with no name:** Displays as date range string (e.g., "3/27 – 4/1") throughout the UI.
- **Send downstairs with no existing harvests:** New harvest form is the only option shown; no empty list state needed.
