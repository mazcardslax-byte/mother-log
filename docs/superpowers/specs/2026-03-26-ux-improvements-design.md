# Mother Log — UX Improvements Design Spec

**Date:** 2026-03-26
**Scope:** Three targeted UX improvements to the Mother Log mobile PWA
**Stack:** React 18 + Vite + Tailwind CSS + Supabase

---

## Feature A — Quick-Log via Swipe-to-Reveal

### Problem
Logging a feeding, amendment, or clone requires opening a plant's detail modal, navigating to the correct tab, filling out a form, and saving — roughly 4–6 taps for the most common daily actions.

### Design
Swipe left on any plant card in the Mothers tab to reveal three action buttons. The card slides left to expose the buttons underneath; tapping anywhere outside collapses it back.

**Actions:**
- **💧 Water** — logs immediately with today's date and type "Water Only". No sheet, no confirmation. Single tap.
- **🌿 Amend** — opens a minimal bottom sheet containing: amendment dropdown (same 13 options as detail modal), optional notes text field, and a Confirm button. Closes and collapses the card on confirm.
- **✂️ Clone** — opens a minimal bottom sheet containing: numeric count input, optional notes text field, and a Confirm button. Closes and collapses the card on confirm.

**Interaction details:**
- Swipe implemented with native touch events (touchstart / touchmove / touchend) — no library dependency
- Each card tracks its own open/closed swipe state via a `swipedId` state in the MothersTab component
- Only one card can be swiped open at a time; opening a new one collapses the previous
- Tapping the card body while swiped navigates to the detail modal as normal
- All quick-log entries write to the same `amendmentLog`, `cloneLog`, and `feedingLog` arrays on the mother object and trigger the existing Supabase save effect

**Bottom sheet spec:**
- Same modal pattern as existing sheets (backdrop blur, rounded-3xl, drag handle)
- Minimal: no date picker (defaults to today), no secondary fields
- Confirm button disabled until required field is filled (amendment name or clone count ≥ 1)

---

## Feature B — Plant History Timeline

### Problem
Plant activity is split across 5 separate tabs (Transplants, Amendments, Clones, Feeding, Reductions). Answering "what happened to this plant recently?" requires checking each tab individually.

### Design
Replace the 5 log tabs with a single **History** tab. The modal moves from 7 tabs to 3:

| Before | After |
|--------|-------|
| Overview | Overview |
| Transplants | History |
| Amendments | Photos |
| Clones | |
| Feeding | |
| Reductions | |
| Photos | |

**Timeline layout:**
- Entries sorted newest-first
- Each entry shows: colored type pill (left border accent), event summary line, date, optional notes
- Type color coding:
  - Transplant — sky blue
  - Amendment — violet
  - Feeding — emerald
  - Clone — stone/warm gray
  - Reduction — red

**Adding entries:**
- A **＋ Add** button at the top of the History tab opens a type picker sheet (5 buttons, one per log type)
- Selecting a type opens the same minimal form used today for that log type
- No functional change to the data structures — entries still write to their respective arrays (`transplantHistory`, `amendmentLog`, etc.)

**Deleting entries:**
- Long-press or swipe-left on any timeline entry reveals a delete button (same pattern as current per-tab delete)

**Empty state:**
- "No history yet — tap + to log the first event" with a faint timeline graphic

---

## Feature C — Room Grid Health Heatmap

### Problem
The room grid shows occupied spots with small health dots that are hard to read at a glance. You can't quickly identify which corner of the room has struggling plants without inspecting each cell.

### Design
Occupied spot cells use a full background color driven by the plant's health level:

| Health | Background | Border | Text |
|--------|-----------|--------|------|
| 5 — Excellent | `#052e16` (deep emerald) | `#16a34a` | `#bbf7d0` |
| 4 — Good | `#052e16` (deep emerald) | `#16a34a` | `#bbf7d0` |
| 3 — Moderate | `#422006` (dark amber) | `#ca8a04` | `#fef08a` |
| 2 — Fair | `#3b0000` (deep red) | `#dc2626` | `#fca5a5` |
| 1 — Poor | `#3b0000` (deep red) | `#dc2626` | `#fca5a5` |

For spots with multiple mothers, the worst (lowest) health level determines the cell color.

Empty spots (dashed border) and upcoming spots (indigo) are visually unchanged.

**Implementation:** Change is isolated to the `SpotCell` component — update the background class logic that currently uses a near-black background for all occupied cells.

---

## Data & State

No schema changes. All three features operate on existing data structures:
- `mother.feedingLog[]`, `mother.amendmentLog[]`, `mother.cloneLog[]` — unchanged
- `mother.transplantHistory[]`, `mother.reductionLog[]` — unchanged
- `mother.healthLevel` (1–5 integer) — unchanged
- Supabase save effects triggered automatically by existing `mothers` state change

---

## Out of Scope

- Notifications / push alerts
- Strain management UI
- Clone tracker tab (handled by separate app)
- Feeding schedule / daily checklist
- Any schema normalization
