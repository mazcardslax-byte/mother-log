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
- **💧 Water** — logs immediately with today's date, no sheet, no confirmation. Single tap. The Clone action is hidden for Sidelined plants. Water and Amend remain available for all statuses.
- **🌿 Amend** — opens a minimal bottom sheet. Amendment input uses the same searchable text field with autocomplete suggestion list as the existing Log Amendment modal (not a `<select>`). Includes an optional notes field and a Confirm button. Closes and collapses the card on confirm. Confirm is disabled until an amendment name is entered.
- **✂️ Clone** — opens a minimal bottom sheet containing: numeric count input (min 1), optional notes text field, and a Confirm button. Closes and collapses the card on confirm. Confirm is disabled until count ≥ 1. Hidden for Sidelined plants.

**Entry construction:**
- Water log: `{ id: uid(), date: today(), type: 'Water Only', notes: '' }` — passed to the existing `addFeedingEntry` function on the mother.
- Amend log: `{ id: uid(), date: today(), amendment: <selected>, notes: <input> }` — passed to existing `addAmendEntry`.
- Clone log: `{ id: uid(), date: today(), count: <input>, notes: <input> }` — passed to existing `addCloneEntry`.

**Interaction details:**
- Implemented with native touch events (touchstart / touchmove / touchend).
- If horizontal swipe distance exceeds 40px, `preventDefault()` is called on touchend and the resulting click event is suppressed via a ref flag (`swipeDidFire`) checked in the card's onClick handler. Below 40px, treat as a tap and open the detail modal.
- Each card tracks its own open/closed swipe state via a single `swipedId` state in MothersTab — setting a new `swipedId` collapses the previous card.
- Only one card can be swiped open at a time.
- Tapping the card body while not swiped (or after snap-back) opens the detail modal as normal.
- All quick-log entries write to the existing state arrays and trigger the existing Supabase save effect.

**Bottom sheet spec:**
- Same modal pattern as existing sheets (backdrop blur, rounded-3xl, drag handle).
- Minimal: no date picker (defaults to today), no secondary fields beyond those listed.

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
- All entries from `transplantHistory`, `amendmentLog`, `feedingLog`, `cloneLog`, and `reductionLog` are merged and sorted newest-first by `date`.
- Entries with `date: null` (transplants marked "date unknown") sort to the bottom and display "Date unknown" in the date field.
- Each entry shows: colored left-border type pill, event summary line, date, optional notes.
- Type color coding:
  - Transplant — sky blue (`text-sky-400 border-sky-700`)
  - Amendment — violet (`text-violet-400 border-violet-700`)
  - Feeding — emerald (`text-emerald-400 border-emerald-700`)
  - Clone — stone (`text-stone-300 border-stone-600`)
  - Reduction — red (`text-red-400 border-red-700`)
- Clone-type timeline entries include the "Send to Clone Log" button, same as the current Clones tab.

**Adding entries:**
- A **＋ Add** button at the top of the History tab opens a type-picker sheet (5 labeled buttons, one per log type).
- Selecting a type closes the type-picker and opens that type's form sheet. If the user closes the form sheet without submitting, they return to the History tab — the type-picker does not reappear.
- Implemented with a single `activeSheet` state: `null | 'picker' | 'transplant' | 'amendment' | 'clone' | 'feeding' | 'reduction'`.
- No functional change to data structures — entries still write to their respective arrays.

**Deleting entries:**
- Each timeline entry shows the same always-visible ✕ delete button used in existing log tabs. No swipe-to-delete; long-press is out of scope.

**Empty state:**
- "No history yet — tap + to log the first event."

---

## Feature C — Room Grid Health Heatmap

### Problem
The room grid shows occupied spots with small health dots that are hard to read at a glance. You can't quickly identify which corner of the room has struggling plants without inspecting each cell.

### Design
Occupied spot cells use full background and border colors driven by the plant's health level, using Tailwind utility classes consistent with the rest of the codebase:

| Health | Tailwind Background | Tailwind Border | Tailwind Text |
|--------|-------------------|-----------------|---------------|
| 5 — Excellent | `bg-emerald-950` | `border-green-600` | `text-green-200` |
| 4 — Good | `bg-emerald-950` | `border-green-600` | `text-green-200` |
| 3 — Moderate | `bg-amber-950` | `border-yellow-600` | `text-yellow-200` |
| 2 — Fair | `bg-red-950` | `border-red-600` | `text-red-300` |
| 1 — Poor | `bg-red-950` | `border-red-600` | `text-red-300` |

For spots with multiple mothers, the worst (lowest) health level determines the cell color.

Empty spots (dashed border) and upcoming spots (indigo) are visually unchanged.

**Legend update:** The Room tab legend is updated to show three colored swatches: green (Excellent/Good), amber (Moderate), red (Poor/Fair), labeled accordingly. The single generic "Mother" swatch is removed.

**Implementation:** Change is isolated to the `SpotCell` component — update the background/border/text class logic. No inline `style` attributes; all classes must be complete Tailwind strings (no dynamic string construction, to ensure PurgeCSS compatibility).

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
- Swipe-to-delete on timeline entries
- Long-press interactions of any kind
