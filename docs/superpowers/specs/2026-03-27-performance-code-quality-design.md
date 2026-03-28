# Performance + Code Quality Pass — Mother Log PWA

**Date:** 2026-03-27
**Status:** Approved
**Scope:** Phase A — performance and code quality only, no visual changes

---

## Problem

The app is sluggish during daily floor use, primarily due to preventable cascade re-renders and missing memoization. Specific pain points:

1. Every keystroke in the amendment search box re-renders the entire app tree (Summary, Mothers, Room, Facility tabs all re-render unnecessarily).
2. Every mother update triggers a double re-render because `detailMother` is synced via `useEffect` instead of being derived.
3. `StrainGroup` is memoized but the memo is silently defeated by inline arrow functions passed as props.
4. Mutation functions in root are recreated every render, making `useCallback` on handlers pointless until they are also stabilized.
5. Amendment search UI is duplicated in two places with identical logic.

---

## Goals

- Eliminate all preventable cascade re-renders during common daily interactions.
- Make existing and new memoization actually work end-to-end.
- Remove dead code and module-level waste.
- Deduplicate repeated UI patterns.

---

## Section 1: Stop cascade re-renders

### 1a — Move modal form state into MotherDetailModal

**Current:** `MotherPlantTracker` root holds 11 `useState` calls for modal forms:
- 5 open/close booleans: `showTransplantModal`, `showAmendModal`, `showCloneModal`, `showFeedingModal`, `showReductionModal`
- 5 form objects: `transplantForm`, `amendForm`, `cloneForm`, `feedingForm`, `reductionForm`
- 1 search string: `amendSearch`

Any field change triggers a full root re-render cascading through all tabs.

**Fix:** Move all 11 into `MotherDetailModal`. Root no longer owns any modal form state.

**Note on detailTab:** `detailTab` and `setDetailTab` stay in root. They are used in `onSelectMother` (which resets the tab to "Overview" when a new mother is selected) and are the mechanism that controls which tab the modal opens to. Do not move them.

**Also remove:** The `useEffect` at lines 547–560 that resets form state when `detailMother?.id` changes. Since all form state is now inside the modal, and `key={detailMother.id}` on the modal element already unmounts/remounts it when a different mother is opened (resetting all component state automatically), this effect is fully redundant.

### 1b — Derive detailMother from id, not synced object

**Current:** Root stores `detailMother` as a full object. A `useEffect` at lines 538–545 watches `[mothers, detailMother?.id]` to keep it in sync, causing two renders per mother update: one when `mothers` updates, one when the effect re-sets `detailMother`.

**Fix:** Root stores `detailMotherId` (string | null). Derive during render:
```js
const detailMother = detailMotherId
  ? mothers.find(m => m.id === detailMotherId) ?? null
  : null;
```
Delete the sync `useEffect` entirely. As a side effect, when a real-time sync arrives and updates `mothers`, the modal will immediately reflect the new data with no extra effect needed.

**Update these call sites (they reference the old setter by name):**
- `deleteMother` (line ~570): change `setDetailMother(null)` → `setDetailMotherId(null)`
- `onClose` prop on `MotherDetailModal` (line ~865): change `() => setDetailMother(null)` → `() => setDetailMotherId(null)`
- All 3 `onSelectMother` inline arrows (lines ~819, 827, 839): change `m => { setDetailMother(m); ... }` → `m => { setDetailMotherId(m.id); ... }`

---

## Section 2: Memoization + stabilized callbacks

For `React.memo` to work end-to-end, **all** functions passed as props must be stable references. This requires two layers of work: stabilizing the mutation functions themselves, then wrapping the handlers that call them.

### 2a — Wrap mutation functions with useCallback(fn, [])

The mutation functions in root (`updateMother`, `deleteMother`, `addTransplant`, `addAmendment`, `addClone`, `addFeeding`, `addReduction`, `removeTransplant`, `removeAmendment`, `removeClone`, `removeFeeding`, `removeReduction`) all use functional `setMothers(prev => ...)` updaters with no closure over other state. They recreate on every root render, making handler `useCallback`s pointless.

**Fix:** Wrap each with `useCallback(fn, [])`. Their deps are `[]` because they only use the functional setter form.

### 2b — Hoist currentContainer and currentTransplantDate to module scope

`currentContainer` and `currentTransplantDate` are pure functions (lines ~681–688) — they take a mother object and return a value with no closure over component state. They are currently defined inside `MotherPlantTracker`, creating new references every render.

**Fix:** Move both to module scope alongside the other utility functions. No `useCallback` needed — module-level functions have stable references by definition.

### 2c — Wrap components with React.memo

- `MotherDetailModal` — 400-line component, currently re-renders on any root state change. Note: `key={detailMother.id}` on the JSX element bypasses memo when switching mothers, which is correct and intentional — it forces a full remount to reset all internal state. Memo still benefits all renders where the same mother stays open.
- `MotherCard` — rendered once per plant; recalculates several derived values per render.
- `SummaryTab` — runs 6 filter/reduce/map operations on `mothers` every render.

### 2d — Stabilize callbacks that defeat StrainGroup memo

In `MothersTab`, wrap with `useCallback`:
- `onToggle` — deps `[]` (uses functional setState only)
- `onSwipeOpen` — deps `[]`
- `onSwipeClose` — deps `[]`

In root, wrap with `useCallback`:
- All handlers passed to `MotherDetailModal` — deps `[detailMotherId]` (now safe because mutation functions from 2a are stable)
- `onSelectMother` — deps `[]` (only calls stable setters: `setDetailMotherId`, `setDetailTab`)
- `onClose` — deps `[]`

### 2e — Add useMemo for computed lists

| Computation | Location | Deps |
|---|---|---|
| `active`, `sidelined`, `totalClones` | Root | `[mothers]` |
| `filtered` (double-filter) | MothersTab | `[mothers, filter, search]` |
| Strain group Map | MothersTab | `[filtered]` |
| History timeline array | MotherDetailModal | `[mother.amendmentLog, mother.cloneLog, mother.feedingLog, mother.transplantHistory, mother.reductionLog]` |

**Note on `filtered` deps:** `getStrain()` is called inside the filter callbacks but it is a pure module-level function referencing the module-level `STRAINS` constant — it does not need to be in the dep array.

---

## Section 3: Module-level hoisting + dead code

### 3a — Hoist to module scope

| Item | Current location | Fix |
|---|---|---|
| `normTs()` | Inside `MotherPlantTracker` body | Move to module-level utilities (alongside `uid`, `today`, etc.) |
| `TYPE_META` | Inside History render IIFE | Move to module scope |
| `DETAIL_TABS` | Inside `MotherDetailModal` body | Move to module scope alongside `TAB_ITEMS` |
| `currentContainer` | Inside `MotherPlantTracker` body | Move to module scope (see 2b) |
| `currentTransplantDate` | Inside `MotherPlantTracker` body | Move to module scope (see 2b) |

### 3b — Dead imports

- Remove `WifiOff` from lucide-react import (imported, never used in JSX).

### 3c — Dynamic import qrcode

`qrcode` (~85KB minified) is currently bundled eagerly. Convert `printMotherLabel` to async and dynamic-import:

```js
async function printMotherLabel(mother) {
  const win = window.open("", "_blank"); // must open window BEFORE await — mobile Safari blocks popup openers after async gaps
  const QRCode = (await import("qrcode")).default;
  // ... rest of function, use `win` instead of `window.open()`
}
```

The `window.open()` call must remain **before** the `await import(...)`. Moving it after will cause mobile Safari to block the popup.

---

## Section 4: Deduplicate amendment search + color helpers

### 4a — Extract AmendmentPicker component

The amendment search + filtered dropdown UI is identical in two places. Extract a shared component with this interface:

```jsx
// Manages its own search string internally
// Calls onChange(amendmentString) when an option is selected
<AmendmentPicker
  selected={amendmentValue}       // currently selected amendment string
  onSelect={handleAmendmentSelect} // (string) => void
  options={COMMON_AMENDMENTS}
/>
```

The component owns the search input state internally. It only emits upward when an item is selected (not on every search keystroke). Both call sites pass their current amendment string as `selected` and their setter as `onSelect`.

### 4b — Unify threshold color functions

Five functions share the same pattern: `healthColor`, `feedingDaysColor`, `vegDaysColor`, `facilityAgeColor` — each compares a value against thresholds and returns a single Tailwind color class.

`healthBg` returns a compound class string (`"bg-red-900/40 border-red-700/40 text-red-300"`) rather than a single token. **Include it in the unification** — the generic function handles compound strings identically since the threshold config array can hold any string value.

Extract:
```js
// thresholds: array of { max: number, cls: string }, ordered from lowest max to highest
// Returns cls of the first threshold where value <= max, or last entry's cls as default
function thresholdColor(value, thresholds) {
  return (thresholds.find(t => value <= t.max) ?? thresholds.at(-1)).cls;
}
```

Each existing function becomes a one-liner:
```js
const healthColor = (h) => thresholdColor(h, [
  { max: 2, cls: "text-red-400" },
  { max: 3, cls: "text-yellow-400" },
  { max: 4, cls: "text-emerald-400" },
  { max: 5, cls: "text-emerald-300" },
]);
```

---

## What is NOT changing

- No visual design changes (that is Phase B)
- No file splitting (App.jsx stays as one file for now)
- No changes to Supabase sync logic, pendingTimestampsRef, or saveReadyRef
- No changes to data structures

---

## Testing checklist

- [ ] Amendment search input — typing does not cause visible lag or full-page flash
- [ ] Logging water/amend/clone — confirmation feels instant
- [ ] Mother detail modal opens to Overview tab correctly
- [ ] Open modal for Mother A → close → open for Mother B — no stale state from Mother A (notes, edit modes, form values all reset)
- [ ] Detail tab switching (Overview/History/Photos) works correctly
- [ ] Delete a mother while the detail modal is open — modal closes, mother disappears from list, app does not crash
- [ ] Real-time sync: update a mother on a second device while detail modal is open — modal reflects the update without needing to close and reopen
- [ ] Swipe-to-reveal on mother cards still works
- [ ] Room grid spot assignment still works
- [ ] Facility log entries still save
- [ ] Print label still works (now async, popup must open)
- [ ] Real-time sync works between two devices end-to-end
- [ ] CSV export still works
