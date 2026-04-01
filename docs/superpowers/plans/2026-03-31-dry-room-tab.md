# Dry Room Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-contained Dry Room tab to the mother app for tracking harvested flower on drying racks, with Hanging, Archive, and Bins (stub) sub-tabs.

**Architecture:** `DryRoomTab.jsx` is a fully self-contained component (same pattern as `ClonesTab.jsx`) with its own Supabase data layer under key `dryroom`. Pure utility functions live in `dry-room-utils.js` and are unit-tested. App.jsx gets minimal changes: import, TAB_ITEMS entry, and a render condition.

**Tech Stack:** React 18, Vite, Vitest, Tailwind CSS, Supabase (key-value JSON), lucide-react

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/dry-room-utils.js` | Create | Pure functions: daysHanging, daysRemaining, countdownColor, sortByUrgency |
| `src/dry-room-utils.test.js` | Create | Vitest unit tests for all utils |
| `src/DryRoomTab.jsx` | Create | Full UI: data layer, sub-tabs, Hanging, Archive, Bins stub, AddBatch modal |
| `src/App.jsx` | Modify | Import Wind + DryRoomTab, add to TAB_ITEMS, add render condition |

---

## Task 1: Pure utility functions + tests

**Files:**
- Create: `src/dry-room-utils.js`
- Create: `src/dry-room-utils.test.js`

- [ ] **Step 1.1: Create `src/dry-room-utils.js`**

```js
// src/dry-room-utils.js

export const DRY_DAYS = 15;

/**
 * Returns how many full calendar days have elapsed since dateHung (ISO date string).
 * Uses local midnight comparison to avoid timezone drift.
 */
export function daysHanging(dateHung) {
  if (!dateHung) return 0;
  const [y, m, d] = dateHung.split("-").map(Number);
  const hung = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - hung) / 86400000));
}

/**
 * Days left before the 15-day drying window closes.
 * Negative means overdue.
 */
export function daysRemaining(dateHung) {
  return DRY_DAYS - daysHanging(dateHung);
}

/**
 * Returns a Tailwind text color class based on days remaining.
 */
export function countdownColor(remaining) {
  if (remaining <= 0) return "text-red-500";
  if (remaining <= 3) return "text-red-400";
  if (remaining <= 7) return "text-amber-400";
  return "text-emerald-400";
}

/**
 * Sorts batches ascending by daysRemaining (most urgent first).
 */
export function sortByUrgency(batches, today = new Date().toISOString().split("T")[0]) {
  return [...batches].sort((a, b) => daysRemaining(a.dateHung) - daysRemaining(b.dateHung));
}
```

- [ ] **Step 1.2: Create `src/dry-room-utils.test.js`**

```js
// src/dry-room-utils.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { daysHanging, daysRemaining, countdownColor, sortByUrgency, DRY_DAYS } from './dry-room-utils';

describe('daysHanging', () => {
  it('returns 0 when dateHung is today', () => {
    const today = new Date().toISOString().split("T")[0];
    expect(daysHanging(today)).toBe(0);
  });

  it('returns 1 when dateHung was yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split("T")[0];
    expect(daysHanging(yesterday)).toBe(1);
  });

  it('returns 15 when dateHung was 15 days ago', () => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    const date = d.toISOString().split("T")[0];
    expect(daysHanging(date)).toBe(15);
  });

  it('returns 0 for null input', () => {
    expect(daysHanging(null)).toBe(0);
  });
});

describe('daysRemaining', () => {
  it('returns 15 when hung today', () => {
    const today = new Date().toISOString().split("T")[0];
    expect(daysRemaining(today)).toBe(15);
  });

  it('returns 0 when hung exactly 15 days ago', () => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    expect(daysRemaining(d.toISOString().split("T")[0])).toBe(0);
  });

  it('returns negative when overdue', () => {
    const d = new Date();
    d.setDate(d.getDate() - 16);
    expect(daysRemaining(d.toISOString().split("T")[0])).toBe(-1);
  });
});

describe('countdownColor', () => {
  it('returns red-500 when overdue (remaining <= 0)', () => {
    expect(countdownColor(0)).toBe("text-red-500");
    expect(countdownColor(-1)).toBe("text-red-500");
  });

  it('returns red-400 for 1-3 days remaining', () => {
    expect(countdownColor(1)).toBe("text-red-400");
    expect(countdownColor(3)).toBe("text-red-400");
  });

  it('returns amber for 4-7 days remaining', () => {
    expect(countdownColor(4)).toBe("text-amber-400");
    expect(countdownColor(7)).toBe("text-amber-400");
  });

  it('returns emerald for 8+ days remaining', () => {
    expect(countdownColor(8)).toBe("text-emerald-400");
    expect(countdownColor(15)).toBe("text-emerald-400");
  });
});

describe('sortByUrgency', () => {
  it('sorts batches with least days remaining first', () => {
    const today = new Date();
    const d = (offset) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - offset);
      return dt.toISOString().split("T")[0];
    };
    const batches = [
      { id: 'a', dateHung: d(2) },  // 13 remaining
      { id: 'b', dateHung: d(14) }, // 1 remaining
      { id: 'c', dateHung: d(0) },  // 15 remaining
    ];
    const sorted = sortByUrgency(batches);
    expect(sorted[0].id).toBe('b');
    expect(sorted[1].id).toBe('a');
    expect(sorted[2].id).toBe('c');
  });

  it('does not mutate the original array', () => {
    const today = new Date().toISOString().split("T")[0];
    const batches = [{ id: 'x', dateHung: today }];
    sortByUrgency(batches);
    expect(batches[0].id).toBe('x');
  });
});
```

- [ ] **Step 1.3: Run tests — expect all PASS**

```bash
cd C:/Users/zacho/mother-log && npm test
```

Expected: all 11 tests pass.

- [ ] **Step 1.4: Commit**

```bash
cd C:/Users/zacho/mother-log && git add src/dry-room-utils.js src/dry-room-utils.test.js && git commit -m "feat: add dry room utility functions with tests"
```

---

## Task 2: DryRoomTab.jsx — data layer + sub-tab shell

**Files:**
- Create: `src/DryRoomTab.jsx`

- [ ] **Step 2.1: Create `src/DryRoomTab.jsx` with imports, STRAINS, constants, utilities, and data layer**

```jsx
// src/DryRoomTab.jsx
import { useState, useEffect, useCallback } from "react";
import { loadFromDB, saveToDB, subscribeToKey } from "./supabase";
import Wind from "lucide-react/dist/esm/icons/wind";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import X from "lucide-react/dist/esm/icons/x";
import { daysHanging, daysRemaining, countdownColor, sortByUrgency } from "./dry-room-utils";

// ── Strains ──────────────────────────────────────────────────────────────────
const STRAINS = [
  { code: "2000", name: "Electric PB Cookie #33" },
  { code: "2001", name: "Burn Out #33" },
  { code: "2002", name: "Grape Cake Mintz" },
  { code: "2003", name: "Garlic Ice Mintz" },
  { code: "2004", name: "Fugazi Funk" },
  { code: "2006", name: "Peach Destiny" },
  { code: "2007", name: "Garlic Icing" },
  { code: "2008", name: "Blue Moon" },
  { code: "2009", name: "Larry Bird Mintz" },
  { code: "2010", name: "Dog Walker" },
  { code: "2011", name: "Point Break" },
  { code: "2013", name: "Gary Payton" },
  { code: "2014", name: "Electric PB Cookie #2" },
  { code: "2015", name: "Lunch Money" },
  { code: "2016", name: "Burn Out Chicago" },
  { code: "2018", name: "Mantarin Butter" },
  { code: "2019", name: "Z-Truffles" },
  { code: "2020", name: "Rainbow Runtz" },
  { code: "2021", name: "Empire 54" },
  { code: "2023", name: "Papaya Runtz" },
  { code: "2024", name: "Chocolate Rolex" },
];

// ── Constants ─────────────────────────────────────────────────────────────────
const DB_KEY = "dryroom";
const CACHE_KEY = "dryroom";
const DRY_ROOM_SUB_TABS = ["Hanging", "Archive", "Bins"];
const MAIN_RACK_MAX = 22;
const SIDE_RACK_MAX = 12;

const DEFAULT_DATA = { active: [], archive: [], bins: [] };

// ── Utilities ─────────────────────────────────────────────────────────────────
function load(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}/${y}`;
}
function getStrainName(code) {
  return STRAINS.find(s => s.code === code)?.name ?? "Unknown";
}
function normTs(ts) { try { return ts ? new Date(ts).toISOString() : null; } catch { return ts; } }

// ── Main component ─────────────────────────────────────────────────────────────
export default function DryRoomTab() {
  const [data, setData]         = useState(() => load(CACHE_KEY) ?? DEFAULT_DATA);
  const [subTab, setSubTab]     = useState("Hanging");
  const [synced, setSynced]     = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [lastTs, setLastTs]     = useState(null);

  // ── Data layer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setSyncing(true);
    loadFromDB(DB_KEY).then(remote => {
      if (remote) {
        const merged = { ...DEFAULT_DATA, ...remote };
        setData(merged);
        save(CACHE_KEY, merged);
      }
      setSynced(true);
      setSyncing(false);
    }).catch(() => { setSyncError("Load failed"); setSyncing(false); });
  }, []);

  useEffect(() => {
    const unsub = subscribeToKey(DB_KEY, (remote, ts) => {
      if (normTs(ts) === normTs(lastTs)) return;
      setLastTs(ts);
      const merged = { ...DEFAULT_DATA, ...remote };
      setData(merged);
      save(CACHE_KEY, merged);
    });
    return unsub;
  }, [lastTs]);

  const persist = useCallback((next) => {
    setData(next);
    save(CACHE_KEY, next);
    saveToDB(DB_KEY, next).catch(() => setSyncError("Save failed"));
  }, []);

  // ── Batch actions ─────────────────────────────────────────────────────────────
  const addBatch = useCallback((fields) => {
    const batch = { id: uid(), ...fields };
    persist({ ...data, active: [...data.active, batch] });
  }, [data, persist]);

  const binBatch = useCallback((id) => {
    const batch = data.active.find(b => b.id === id);
    if (!batch) return;
    const archived = { ...batch, dateBinned: today() };
    persist({
      ...data,
      active: data.active.filter(b => b.id !== id),
      archive: [archived, ...data.archive],
    });
  }, [data, persist]);

  // ── Derived counts ────────────────────────────────────────────────────────────
  const mainCount    = data.active.filter(b => b.rackType === "main").length;
  const sideCount    = data.active.filter(b => b.rackType === "side").length;
  const overdueCount = data.active.filter(b => daysRemaining(b.dateHung) <= 0).length;

  // ── Sub-tab bar ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Sync indicator */}
      <div className="flex items-center gap-1.5 px-4 pt-2 pb-1">
        {syncing && <Loader2 size={12} className="text-zinc-500 animate-spin" />}
        {!syncing && synced && !syncError && <Wifi size={12} className="text-emerald-500" />}
        {syncError && <><WifiOff size={12} className="text-red-400" /><span className="text-[10px] text-red-400">{syncError}</span></>}
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-1 px-4 pb-3">
        {DRY_ROOM_SUB_TABS.map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              subTab === t
                ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                : "text-zinc-500 hover:text-zinc-300 border border-transparent"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {subTab === "Hanging" && (
          <HangingPanel
            active={data.active}
            mainCount={mainCount}
            sideCount={sideCount}
            overdueCount={overdueCount}
            onAdd={addBatch}
            onBin={binBatch}
          />
        )}
        {subTab === "Archive" && <ArchivePanel archive={data.archive} />}
        {subTab === "Bins"    && <BinsPanel />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2.2: Add placeholder panel stubs at the bottom of the file** (append after the DryRoomTab closing brace)

```jsx
// ── Panel stubs (filled in subsequent tasks) ──────────────────────────────────
function HangingPanel({ active, mainCount, sideCount, overdueCount, onAdd, onBin }) {
  return <div className="text-zinc-500 text-sm py-8 text-center">Hanging panel coming soon</div>;
}

function ArchivePanel({ archive }) {
  return <div className="text-zinc-500 text-sm py-8 text-center">Archive panel coming soon</div>;
}

function BinsPanel() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center mt-2">
      <div className="text-zinc-400 text-sm font-medium mb-1">Bin Tracking</div>
      <div className="text-zinc-600 text-xs">Coming soon — tote inventory will live here.</div>
    </div>
  );
}
```

- [ ] **Step 2.3: Commit**

```bash
cd C:/Users/zacho/mother-log && git add src/DryRoomTab.jsx && git commit -m "feat: scaffold DryRoomTab with data layer and sub-tab shell"
```

---

## Task 3: Wire DryRoomTab into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 3.1: Add Wind import and DryRoomTab import**

In `src/App.jsx`, find this block (around line 9):
```jsx
import {
  LayoutDashboard, Leaf, Grid3X3, Plus, Download,
  Wifi, Loader2, AlertCircle,
  ChevronDown, Droplets, ClipboardList,
  Scissors, FlaskConical, ChevronRight, BarChart2,
} from "lucide-react";
```

Replace with:
```jsx
import {
  LayoutDashboard, Leaf, Grid3X3, Plus, Download,
  Wifi, Loader2, AlertCircle,
  ChevronDown, Droplets, ClipboardList,
  Scissors, FlaskConical, ChevronRight, BarChart2, Wind,
} from "lucide-react";
```

- [ ] **Step 3.2: Add DryRoomTab import** (after the StatsTab import on line ~4)

```jsx
import DryRoomTab from "./DryRoomTab";
```

- [ ] **Step 3.3: Add DryRoom to TAB_ITEMS**

Find:
```js
const TAB_ITEMS = [
  { key: "Summary",  label: "Summary",  icon: LayoutDashboard },
  { key: "Mothers",  label: "Mothers",  icon: Leaf },
  { key: "Room",     label: "Room",     icon: Grid3X3 },
  { key: "Facility", label: "Facility", icon: ClipboardList },
  { key: "Stats",    label: "Stats",    icon: BarChart2 },
  { key: "Clones",   label: "Clones",   icon: Scissors },
];
```

Replace with:
```js
const TAB_ITEMS = [
  { key: "Summary",  label: "Summary",  icon: LayoutDashboard },
  { key: "Mothers",  label: "Mothers",  icon: Leaf },
  { key: "Room",     label: "Room",     icon: Grid3X3 },
  { key: "Facility", label: "Facility", icon: ClipboardList },
  { key: "Stats",    label: "Stats",    icon: BarChart2 },
  { key: "DryRoom",  label: "Dry Room", icon: Wind },
  { key: "Clones",   label: "Clones",   icon: Scissors },
];
```

- [ ] **Step 3.4: Add render condition**

Find (around line 830):
```jsx
{tab !== "Clones" && tab !== "Stats" && (
```

Replace with:
```jsx
{tab !== "Clones" && tab !== "Stats" && tab !== "DryRoom" && (
```

Then find (around line 879):
```jsx
      {tab === "Stats" && <StatsTab mothers={mothers} getStrain={getStrain} />}
      {tab === "Clones" && <ClonesTab />}
```

Replace with:
```jsx
      {tab === "Stats"    && <StatsTab mothers={mothers} getStrain={getStrain} />}
      {tab === "DryRoom"  && <DryRoomTab />}
      {tab === "Clones"   && <ClonesTab />}
```

- [ ] **Step 3.5: Verify the app builds**

```bash
cd C:/Users/zacho/mother-log && npm run build
```

Expected: no errors, build succeeds.

- [ ] **Step 3.6: Commit**

```bash
cd C:/Users/zacho/mother-log && git add src/App.jsx && git commit -m "feat: wire DryRoomTab into App.jsx nav and render"
```

---

## Task 4: Implement HangingPanel

**Files:**
- Modify: `src/DryRoomTab.jsx` — replace HangingPanel stub

- [ ] **Step 4.1: Replace the HangingPanel stub with full implementation**

Find and replace the existing `function HangingPanel(...)` stub entirely:

```jsx
// ── Add Batch Modal ────────────────────────────────────────────────────────────
function AddBatchModal({ onClose, onSave }) {
  const [strainCode, setStrainCode] = useState(STRAINS[0].code);
  const [quality, setQuality]       = useState("mid");
  const [rackType, setRackType]     = useState("main");
  const [dateHung, setDateHung]     = useState(today());
  const [note, setNote]             = useState("");

  function handleSave() {
    if (!strainCode || !dateHung) return;
    onSave({ strainCode, quality, rackType, dateHung, note: note.trim() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#0e1512] border border-zinc-700/50 rounded-t-3xl w-full max-w-md shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <span className="text-white font-semibold text-sm">Add Batch</span>
          <button onClick={onClose} aria-label="Close"
            className="text-zinc-500 hover:text-white w-11 h-11 flex items-center justify-center rounded-full hover:bg-zinc-700/50 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-8 overflow-y-auto space-y-4">
          {/* Strain */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Strain</label>
            <select
              value={strainCode}
              onChange={e => setStrainCode(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-600"
            >
              {STRAINS.map(s => (
                <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Quality</label>
            <div className="flex gap-2">
              {["tops", "mid", "lowers"].map(q => (
                <button key={q} onClick={() => setQuality(q)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors capitalize ${
                    quality === q
                      ? q === "tops"   ? "bg-emerald-900/60 text-emerald-300 border-emerald-700"
                      : q === "lowers" ? "bg-amber-900/60 text-amber-300 border-amber-700"
                      :                  "bg-zinc-700 text-zinc-200 border-zinc-600"
                      : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Rack type */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Rack Type</label>
            <div className="flex gap-2">
              {["main", "side"].map(r => (
                <button key={r} onClick={() => setRackType(r)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors capitalize ${
                    rackType === r
                      ? "bg-sky-900/60 text-sky-300 border-sky-700"
                      : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Date hung */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Date Hung</label>
            <input type="date" value={dateHung} onChange={e => setDateHung(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. top shelf"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button onClick={handleSave}
            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl py-3 text-sm font-semibold transition-colors mt-2">
            Add Batch
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Batch Card ─────────────────────────────────────────────────────────────────
function BatchCard({ batch, onBin }) {
  const [confirming, setConfirming] = useState(false);
  const hanging  = daysHanging(batch.dateHung);
  const remaining = daysRemaining(batch.dateHung);
  const color    = countdownColor(remaining);
  const overdue  = remaining <= 0;

  const qualityBadge = batch.quality === "tops"
    ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-900/50 text-emerald-300 border-emerald-700/40 font-medium">TOPS</span>
    : batch.quality === "lowers"
    ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-900/50 text-amber-300 border-amber-700/40 font-medium">LOWERS</span>
    : null;

  const rackBadge = (
    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-sky-900/30 text-sky-400 border-sky-800/40 font-medium capitalize">
      {batch.rackType}
    </span>
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm leading-tight truncate">
            {getStrainName(batch.strainCode)}
          </div>
          <div className="text-zinc-600 text-[10px] mt-0.5">{batch.strainCode}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {qualityBadge}
          {rackBadge}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div>
          <div className="text-zinc-500 text-[10px]">Hung {fmtDate(batch.dateHung)} · {hanging}d hanging</div>
          <div className={`text-xs font-semibold mt-0.5 ${color}`}>
            {overdue
              ? `OVERDUE by ${Math.abs(remaining)}d`
              : `${remaining}d remaining`
            }
          </div>
        </div>
        {confirming ? (
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-500 transition-colors">
              Cancel
            </button>
            <button onClick={() => onBin(batch.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-800 text-emerald-200 border border-emerald-700 hover:bg-emerald-700 transition-colors">
              Confirm
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-colors">
            Bin It
          </button>
        )}
      </div>

      {batch.note && (
        <div className="mt-2 text-zinc-500 text-[10px] italic">{batch.note}</div>
      )}
    </div>
  );
}

// ── Hanging Panel ──────────────────────────────────────────────────────────────
function HangingPanel({ active, mainCount, sideCount, overdueCount, onAdd, onBin }) {
  const [showAdd, setShowAdd] = useState(false);
  const sorted = sortByUrgency(active);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-300 text-xs font-medium">
            {active.length} batch{active.length !== 1 ? "es" : ""} hanging
          </span>
          <span className="text-zinc-600 text-[10px]">·</span>
          <span className="text-zinc-500 text-[10px]">{mainCount} main · {sideCount} side</span>
          {overdueCount > 0 && (
            <>
              <span className="text-zinc-600 text-[10px]">·</span>
              <span className="text-red-400 text-[10px] font-semibold">{overdueCount} overdue</span>
            </>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-800 text-emerald-200 border border-emerald-700 hover:bg-emerald-700 transition-colors"
        >
          + Add Batch
        </button>
      </div>

      {/* Batch list */}
      {sorted.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="text-zinc-400 text-sm font-medium mb-1">Nothing hanging</div>
          <div className="text-zinc-600 text-xs">Tap + Add Batch to log today&apos;s harvest.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(b => (
            <BatchCard key={b.id} batch={b} onBin={onBin} />
          ))}
        </div>
      )}

      {showAdd && <AddBatchModal onClose={() => setShowAdd(false)} onSave={onAdd} />}
    </>
  );
}
```

- [ ] **Step 4.2: Verify the app builds and dev server loads**

```bash
cd C:/Users/zacho/mother-log && npm run build
```

Expected: no errors.

- [ ] **Step 4.3: Commit**

```bash
cd C:/Users/zacho/mother-log && git add src/DryRoomTab.jsx && git commit -m "feat: implement HangingPanel with batch cards and AddBatch modal"
```

---

## Task 5: Implement ArchivePanel

**Files:**
- Modify: `src/DryRoomTab.jsx` — replace ArchivePanel stub

- [ ] **Step 5.1: Replace the ArchivePanel stub**

Find and replace the existing `function ArchivePanel(...)` stub entirely:

```jsx
function ArchivePanel({ archive }) {
  const [search, setSearch] = useState("");

  const filtered = archive.filter(b => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return getStrainName(b.strainCode).toLowerCase().includes(q) || b.strainCode.includes(q);
  });

  return (
    <>
      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search strain…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="text-zinc-400 text-sm font-medium mb-1">
            {archive.length === 0 ? "No archived batches yet" : "No results"}
          </div>
          <div className="text-zinc-600 text-xs">
            {archive.length === 0 ? "Binned batches will appear here." : "Try a different search."}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => {
            const totalDays = (() => {
              if (!b.dateHung || !b.dateBinned) return null;
              const [hy, hm, hd] = b.dateHung.split("-").map(Number);
              const [by, bm, bd] = b.dateBinned.split("-").map(Number);
              const hung   = new Date(hy, hm - 1, hd);
              const binned = new Date(by, bm - 1, bd);
              return Math.max(0, Math.floor((binned - hung) / 86400000));
            })();

            const qualityBadge = b.quality === "tops"
              ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-900/50 text-emerald-300 border-emerald-700/40 font-medium">TOPS</span>
              : b.quality === "lowers"
              ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-900/50 text-amber-300 border-amber-700/40 font-medium">LOWERS</span>
              : null;

            return (
              <div key={b.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                      {getStrainName(b.strainCode)}
                    </div>
                    <div className="text-zinc-600 text-[10px] mt-0.5">{b.strainCode}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {qualityBadge}
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-sky-900/30 text-sky-400 border-sky-800/40 font-medium capitalize">{b.rackType}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500">
                  <span>Hung {fmtDate(b.dateHung)}</span>
                  <span className="text-zinc-700">→</span>
                  <span>Binned {fmtDate(b.dateBinned)}</span>
                  {totalDays !== null && (
                    <><span className="text-zinc-700">·</span><span>{totalDays}d dried</span></>
                  )}
                </div>
                {b.note && <div className="mt-1.5 text-zinc-600 text-[10px] italic">{b.note}</div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5.2: Build to verify**

```bash
cd C:/Users/zacho/mother-log && npm run build
```

Expected: no errors.

- [ ] **Step 5.3: Commit**

```bash
cd C:/Users/zacho/mother-log && git add src/DryRoomTab.jsx && git commit -m "feat: implement ArchivePanel with search and history rows"
```

---

## Task 6: Final tests + deploy

**Files:**
- No new files

- [ ] **Step 6.1: Run full test suite**

```bash
cd C:/Users/zacho/mother-log && npm test
```

Expected: all tests pass, no failures.

- [ ] **Step 6.2: Run dev server and manually verify**

```bash
cd C:/Users/zacho/mother-log && npm run dev
```

Manual checklist:
- [ ] Dry Room tab appears in nav between Stats and Clones
- [ ] Sub-tabs Hanging / Archive / Bins are present
- [ ] Bins tab shows "Coming soon" stub
- [ ] Add Batch opens modal with all fields
- [ ] Adding a batch saves it and shows in the list
- [ ] Batch card shows strain name, quality badge, rack badge, days countdown
- [ ] Most urgent batch is first in the list
- [ ] Color coding correct (green/amber/red)
- [ ] Bin It shows confirmation, then moves batch to Archive
- [ ] Archive shows binned batch with correct dates and "Xd dried"
- [ ] Archive search filters by strain name
- [ ] Header counts (batches, main, side) are correct
- [ ] Overdue label appears correctly for old dates
- [ ] Empty state shows when no batches
- [ ] Existing tabs (Summary, Mothers, Room, Facility, Stats, Clones) unaffected

- [ ] **Step 6.3: Build for production**

```bash
cd C:/Users/zacho/mother-log && npm run build
```

Expected: build succeeds with no errors or warnings.

- [ ] **Step 6.4: Deploy to Vercel**

```bash
cd C:/Users/zacho/mother-log && git push
```

Vercel auto-deploys on push. Verify production URL after deploy completes.
