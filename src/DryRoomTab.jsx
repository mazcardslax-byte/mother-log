// src/DryRoomTab.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { loadFromDB, saveToDB, subscribeToKey } from "./supabase";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import X from "lucide-react/dist/esm/icons/x";
import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { daysHanging, daysRemaining, countdownColor, sortByUrgency, getDaysCured, getBinStatus } from "./dry-room-utils";

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

const DB_KEY = "dryroom";
const DRY_ROOM_SUB_TABS = ["Hanging", "Archive", "Bins"];
const DEFAULT_DATA = { active: [], archive: [], bins: [], harvests: [] };

const QUALITY_ORDER = ["tops", "mid", "lowers"];
const QUALITY_LABELS = { tops: "Tops", mid: "Mid", lowers: "Lowers" };
const QUALITY_COLORS = {
  tops:   { text: "text-emerald-400", border: "border-emerald-800/40" },
  mid:    { text: "text-sky-400",     border: "border-sky-800/40" },
  lowers: { text: "text-amber-400",   border: "border-amber-800/40" },
};

function load(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function save(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}/${y}`;
}
function getStrainName(code) { return STRAINS.find(s => s.code === code)?.name ?? "Unknown"; }
function normTs(ts) { try { return ts ? new Date(ts).toISOString() : null; } catch { return ts; } }

export default function DryRoomTab() {
  const [data, setData]           = useState(() => load(DB_KEY) ?? DEFAULT_DATA);
  const [subTab, setSubTab]       = useState("Hanging");
  const [synced, setSynced]       = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [syncError, setSyncError] = useState(null);
  const lastTsRef = useRef(null);
  useEffect(() => {
    const unsub = subscribeToKey(DB_KEY, (remote, ts) => {
      const normalized = normTs(ts);
      if (normalized && normalized === lastTsRef.current) return;
      lastTsRef.current = normalized;
      const merged = { ...DEFAULT_DATA, ...remote };
      setData(merged);
      save(DB_KEY, merged);
    });
    return () => unsub.unsubscribe();
  }, []);

  useEffect(() => {
    setSyncing(true);
    loadFromDB(DB_KEY).then(remote => {
      if (remote) {
        const merged = { ...DEFAULT_DATA, ...remote };
        setData(merged);
        save(DB_KEY, merged);
      }
      setSynced(true);
      setSyncing(false);
    }).catch(() => { setSyncError("Load failed"); setSyncing(false); });
  }, []);

  const persist = useCallback((updater) => {
    setData(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      save(DB_KEY, next);
      const ts = new Date().toISOString();
      saveToDB(DB_KEY, next, ts).then(() => setSyncError(null)).catch(() => setSyncError("Save failed"));
      return next;
    });
  }, []);

  const addBatch = useCallback((fields) => {
    const batch = { id: uid(), ...fields };
    persist(prev => ({ ...prev, active: [...prev.active, batch] }));
  }, [persist]);

  const binBatch = useCallback((id) => {
    persist(prev => {
      const batch = prev.active.find(b => b.id === id);
      if (!batch) return prev;
      const archived = { ...batch, dateBinned: today() };
      return {
        ...prev,
        active: prev.active.filter(b => b.id !== id),
        archive: [archived, ...prev.archive],
      };
    });
  }, [persist]);

  const handleDelete = useCallback((id) => {
    persist(prev => ({ ...prev, active: prev.active.filter(b => b.id !== id) }));
  }, [persist]);

  const mainCount    = data.active.filter(b => b.rackType === "main").reduce((s, b) => s + (b.size ?? 1), 0);
  const sideCount    = data.active.filter(b => b.rackType === "side").reduce((s, b) => s + (b.size ?? 1), 0);
  const overdueCount = data.active.filter(b => daysRemaining(b.dateHung) <= 0).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-4 pt-2 pb-1">
        {syncing && <Loader2 size={12} className="text-[#6a5a3a] animate-spin" />}
        {!syncing && synced && !syncError && <Wifi size={12} className="text-amber-600" />}
        {syncError && <><WifiOff size={12} className="text-red-400" /><span className="text-[10px] text-red-400">{syncError}</span></>}
      </div>

      <div className="flex gap-1 px-4 pb-3">
        {DRY_ROOM_SUB_TABS.map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              subTab === t
                ? "bg-[#2a1f00] text-amber-300 border border-[#3a2e00]"
                : "text-[#6a5a3a] hover:text-[#c5b08a] border border-transparent"
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {subTab === "Hanging" && (
          <HangingPanel active={data.active} mainCount={mainCount} sideCount={sideCount}
            overdueCount={overdueCount} onAdd={addBatch} onBin={binBatch} onDelete={handleDelete} />
        )}
        {subTab === "Archive" && <ArchivePanel archive={data.archive} />}
        {subTab === "Bins"    && <BinsPanel data={data} persist={persist} />}
      </div>
    </div>
  );
}

function AddBatchModal({ onClose, onSave }) {
  const [strainCode, setStrainCode] = useState(STRAINS[0].code);
  const [quality, setQuality]       = useState("mid");
  const [rackType, setRackType]     = useState("main");
  const [dateHung, setDateHung]     = useState(today());
  const [note, setNote]             = useState("");
  const [count, setCount]           = useState(1);
  const [size, setSize]             = useState(1.0);

  function handleSave() {
    if (!strainCode || !dateHung) return;
    const fields = { strainCode, quality, rackType, dateHung, note: note.trim(), size };
    for (let i = 0; i < count; i++) onSave(fields);
    setSize(1.0);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#0f0f0f] border border-[#2a2418]/50 rounded-t-3xl w-full max-w-md shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#2a2418]" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <span className="text-[#f5f5f0] font-semibold text-sm">Add Batch</span>
          <button onClick={onClose} aria-label="Close"
            className="text-[#6a5a3a] hover:text-[#f5f5f0] w-11 h-11 flex items-center justify-center rounded-full hover:bg-[#1a1a1a] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-8 overflow-y-auto space-y-4">
          {/* Strain */}
          <div>
            <label className="text-xs text-[#c5b08a] mb-1 block">Strain</label>
            <select value={strainCode} onChange={e => setStrainCode(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-amber-500">
              {STRAINS.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          {/* Quality */}
          <div>
            <label className="text-xs text-[#c5b08a] mb-1 block">Quality</label>
            <div className="flex gap-2">
              {["tops", "mid", "lowers"].map(q => (
                <button key={q} onClick={() => setQuality(q)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors capitalize ${
                    quality === q
                      ? q === "tops"   ? "bg-emerald-900/60 text-emerald-300 border-emerald-700"
                      : q === "lowers" ? "bg-amber-900/60 text-amber-300 border-amber-700"
                      :                  "bg-[#2a2418] text-[#f5f5f0] border-[#2a2418]"
                      : "bg-[#111111] text-[#6a5a3a] border-[#1a1a1a] hover:border-[#2a2418]"
                  }`}>
                  {q}
                </button>
              ))}
            </div>
          </div>
          {/* Rack type */}
          <div>
            <label className="text-xs text-[#c5b08a] mb-1 block">Rack Type</label>
            <div className="flex gap-2">
              {["main", "side"].map(r => (
                <button key={r} onClick={() => setRackType(r)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors capitalize ${
                    rackType === r
                      ? "bg-sky-900/60 text-sky-300 border-sky-700"
                      : "bg-[#111111] text-[#6a5a3a] border-[#1a1a1a] hover:border-[#2a2418]"
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {/* Rack size */}
          <div className="space-y-1">
            <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wide font-medium">Rack Size</div>
            <div className="flex gap-2">
              {[0.25, 0.5, 0.75, 1.0].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    size === s
                      ? "bg-[#2a2418] border-[#8a6a2a] text-[#f5f5f0]"
                      : "bg-[#111111] border-[#2a2418] text-[#6a5a3a]"
                  }`}
                >
                  {s === 1.0 ? "1.0" : s.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
          {/* Date hung */}
          <div>
            <label className="text-xs text-[#c5b08a] mb-1 block">Date Hung</label>
            <input type="date" value={dateHung} onChange={e => setDateHung(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-amber-500" />
          </div>
          {/* Note */}
          <div>
            <label className="text-xs text-[#c5b08a] mb-1 block">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. top shelf"
              className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none focus:border-amber-500" />
          </div>
          {/* Number of racks */}
          <div>
            <label className="text-xs text-[#c5b08a] mb-1 block">Number of Racks</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setCount(c => Math.max(1, c - 1))}
                className="w-10 h-10 rounded-xl border border-[#2a2418] text-[#c5b08a] hover:border-[#2a2418] hover:text-[#f5f5f0] transition-colors text-lg font-medium flex items-center justify-center">
                −
              </button>
              <span className="text-[#f5f5f0] font-semibold text-lg w-6 text-center">{count}</span>
              <button onClick={() => setCount(c => Math.min(22, c + 1))}
                className="w-10 h-10 rounded-xl border border-[#2a2418] text-[#c5b08a] hover:border-[#2a2418] hover:text-[#f5f5f0] transition-colors text-lg font-medium flex items-center justify-center">
                +
              </button>
            </div>
          </div>
          <button onClick={handleSave}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-3 text-sm font-semibold transition-colors mt-2">
            {count === 1 ? "Add Batch" : `Add ${count} Batches`}
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchCard({ batch, onBin, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hanging   = daysHanging(batch.dateHung);
  const remaining = daysRemaining(batch.dateHung);
  const color     = countdownColor(remaining);
  const overdue   = remaining <= 0;

  const qualityBadge = batch.quality === "tops"
    ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-900/50 text-emerald-300 border-emerald-700/40 font-medium">TOPS</span>
    : batch.quality === "lowers"
    ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-900/50 text-amber-300 border-amber-700/40 font-medium">LOWERS</span>
    : null;

  return (
    <div className="bg-[#111111] border border-[#2a2418] rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[#f5f5f0] font-semibold text-sm leading-tight truncate">{getStrainName(batch.strainCode)}</div>
          <div className="text-[#6a5a3a] text-[10px] mt-0.5">{batch.strainCode}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {qualityBadge}
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-sky-900/30 text-sky-400 border-sky-800/40 font-medium capitalize">{batch.rackType}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2418] text-[#6a5a3a] font-medium">
            ×{(batch.size ?? 1) === 1 ? "1.0" : (batch.size ?? 1).toFixed(2)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div>
          <div className="text-[#6a5a3a] text-[10px]">Hung {fmtDate(batch.dateHung)} · {hanging}d hanging</div>
          <div className={`text-xs font-semibold mt-0.5 ${color}`}>
            {overdue ? `OVERDUE by ${Math.abs(remaining)}d` : `${remaining}d remaining`}
          </div>
        </div>
        {confirming ? (
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-[#c5b08a] border border-[#2a2418] hover:border-[#2a2418] transition-colors">
              Cancel
            </button>
            <button onClick={() => onBin(batch.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2a1f00] text-amber-200 border border-[#3a2e00] hover:bg-[#3a2e0a] transition-colors">
              Confirm
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#c5b08a] border border-[#2a2418] hover:text-[#f5f5f0] hover:border-[#2a2418] transition-colors">
            Bin It
          </button>
        )}
      </div>
      {batch.note && <div className="mt-2 text-[#6a5a3a] text-[10px] italic">{batch.note}</div>}
      {confirmingDelete ? (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#2a2418]">
          <span className="text-xs text-red-400 flex-1">Delete this rack?</span>
          <button
            onClick={() => { setConfirmingDelete(false); onDelete(batch.id); }}
            className="text-xs px-3 py-1 rounded-lg bg-red-900 text-red-300 border border-red-700"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="text-xs px-3 py-1 rounded-lg bg-[#1a1a1a] text-[#888] border border-[#333]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmingDelete(true)}
          className="mt-2 pt-2 border-t border-[#2a2418] w-full text-left text-xs text-[#555] hover:text-red-400 transition-colors"
        >
          Delete rack
        </button>
      )}
    </div>
  );
}

function HangingPanel({ active, mainCount, sideCount, overdueCount, onAdd, onBin, onDelete }) {
  const fmt = n => Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const [showAdd, setShowAdd] = useState(false);

  const emptyTiers = new Set(
    QUALITY_ORDER.filter(q => !active.some(b => b.quality === q))
  );
  const [collapsedQuality, setCollapsedQuality] = useState(emptyTiers);
  useEffect(() => {
    setCollapsedQuality(prev => {
      const next = new Set(prev);
      let changed = false;
      QUALITY_ORDER.forEach(q => {
        if (next.has(q) && active.some(b => b.quality === q)) {
          next.delete(q);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [active]);
  const [collapsedSub, setCollapsedSub] = useState(new Set());

  const toggleQuality = useCallback(q => {
    setCollapsedQuality(prev => {
      const next = new Set(prev);
      next.has(q) ? next.delete(q) : next.add(q);
      return next;
    });
  }, []);

  const toggleSub = useCallback(key => {
    setCollapsedSub(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#c5b08a] text-xs font-medium">
            {active.length} batch{active.length !== 1 ? "es" : ""} hanging
          </span>
          <span className="text-[#6a5a3a] text-[10px]">·</span>
          <span className="text-[#6a5a3a] text-[10px]">{fmt(mainCount)} main · {fmt(sideCount)} side</span>
          {overdueCount > 0 && (
            <><span className="text-[#6a5a3a] text-[10px]">·</span>
            <span className="text-red-400 text-[10px] font-semibold">{overdueCount} overdue</span></>
          )}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#2a1f00] text-amber-200 border border-[#3a2e00] hover:bg-[#3a2e0a] transition-colors">
          + Add Batch
        </button>
      </div>
      {active.length === 0 ? (
        <div className="bg-[#111111] border border-[#2a2418] rounded-2xl p-8 text-center">
          <div className="text-[#c5b08a] text-sm font-medium mb-1">Nothing hanging</div>
          <div className="text-[#6a5a3a] text-xs">Tap + Add Batch to log today&apos;s harvest.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {QUALITY_ORDER.map(quality => {
            const qBatches = active.filter(b => b.quality === quality);
            const qTotal = qBatches.reduce((s, b) => s + (b.size ?? 1), 0);
            const isQCollapsed = collapsedQuality.has(quality);
            const { text: qText, border: qBorder } = QUALITY_COLORS[quality];

            return (
              <div key={quality} className={`rounded-xl border ${qBorder} overflow-hidden`}>
                <button
                  onClick={() => toggleQuality(quality)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#111111]"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-widest ${qText}`}>
                      {QUALITY_LABELS[quality]}
                    </span>
                    <span className="text-[10px] text-[#6a5a3a]">
                      {fmt(qTotal)} rack{qTotal !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-[#6a5a3a] transition-transform ${isQCollapsed ? "" : "rotate-180"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {!isQCollapsed && (
                  <div className="divide-y divide-[#1a1a1a]">
                    {["main", "side"].map(rackType => {
                      const subKey = `${quality}-${rackType}`;
                      const subBatches = sortByUrgency(qBatches.filter(b => b.rackType === rackType));
                      const subTotal = subBatches.reduce((s, b) => s + (b.size ?? 1), 0);
                      const isSubCollapsed = collapsedSub.has(subKey);
                      if (subBatches.length === 0) return null;

                      return (
                        <div key={rackType} className="bg-[#0d0d0d]">
                          <button
                            onClick={() => toggleSub(subKey)}
                            className="w-full flex items-center justify-between px-4 py-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#888] uppercase tracking-wide font-medium">
                                {rackType === "main" ? "Main Rack" : "Side Rack"}
                              </span>
                              <span className="text-[10px] text-[#555]">{fmt(subTotal)}</span>
                            </div>
                            <svg
                              className={`w-3 h-3 text-[#555] transition-transform ${isSubCollapsed ? "" : "rotate-180"}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {!isSubCollapsed && (
                            <div className="px-3 pb-3 space-y-3">
                              {subBatches.map(b => (
                                <BatchCard
                                  key={b.id}
                                  batch={b}
                                  onBin={onBin}
                                  onDelete={onDelete}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showAdd && <AddBatchModal onClose={() => setShowAdd(false)} onSave={onAdd} />}
    </>
  );
}

function ArchivePanel({ archive }) {
  const [search, setSearch] = useState("");
  const filtered = archive.filter(b => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return getStrainName(b.strainCode).toLowerCase().includes(q) || b.strainCode.includes(q);
  });

  return (
    <>
      <div className="mb-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search strain…"
          className="w-full bg-[#111111] border border-[#2a2418] rounded-xl px-3 py-2 text-sm text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none focus:border-[#2a2418]" />
      </div>
      {filtered.length === 0 ? (
        <div className="bg-[#111111] border border-[#2a2418] rounded-2xl p-8 text-center">
          <div className="text-[#c5b08a] text-sm font-medium mb-1">
            {archive.length === 0 ? "No archived batches yet" : "No results"}
          </div>
          <div className="text-[#6a5a3a] text-xs">
            {archive.length === 0 ? "Binned batches will appear here." : "Try a different search."}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => {
            const totalDays = (() => {
              if (!b.dateHung || !b.dateBinned) return null;
              const [hy, hm, hd] = b.dateHung.split("-").map(Number);
              const [by2, bm, bd] = b.dateBinned.split("-").map(Number);
              const hung   = new Date(hy, hm - 1, hd);
              const binned = new Date(by2, bm - 1, bd);
              return Math.max(0, Math.floor((binned - hung) / 86400000));
            })();
            const qualityBadge = b.quality === "tops"
              ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-900/50 text-emerald-300 border-emerald-700/40 font-medium">TOPS</span>
              : b.quality === "lowers"
              ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-900/50 text-amber-300 border-amber-700/40 font-medium">LOWERS</span>
              : null;
            return (
              <div key={b.id} className="bg-[#111111] border border-[#2a2418] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[#f5f5f0] text-sm font-medium truncate">{getStrainName(b.strainCode)}</div>
                    <div className="text-[#6a5a3a] text-[10px] mt-0.5">{b.strainCode}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {qualityBadge}
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-sky-900/30 text-sky-400 border-sky-800/40 font-medium capitalize">{b.rackType}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-[#6a5a3a]">
                  <span>Hung {fmtDate(b.dateHung)}</span>
                  <span className="text-[#2a2418]">→</span>
                  <span>Binned {fmtDate(b.dateBinned)}</span>
                  {totalDays !== null && <><span className="text-[#2a2418]">·</span><span>{totalDays}d dried</span></>}
                </div>
                {b.note && <div className="mt-1.5 text-[#6a5a3a] text-[10px] italic">{b.note}</div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function BurpDots({ fillDate, burps }) {
  const todayStr = today();
  if (!fillDate) return null;

  return (
    <div className="flex gap-0.5 mt-1.5">
      {Array.from({ length: 14 }, (_, i) => {
        const d = new Date(fillDate + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + i + 1);
        const dateStr = d.toISOString().split("T")[0];
        const burped = burps.includes(dateStr);
        const isPast = dateStr < todayStr;
        return (
          <div
            key={i}
            title={`Day ${i + 1}: ${dateStr}${burped ? " ✓" : isPast ? " missed" : ""}`}
            className={`w-2.5 h-2.5 rounded-full ${
              burped ? "bg-emerald-500" : isPast ? "bg-red-800/70" : "bg-[#2a2418]"
            }`}
          />
        );
      })}
    </div>
  );
}

function BinCard({ bin, onBurp, onSend }) {
  const status = getBinStatus(bin);
  const days = getDaysCured(bin);
  const t = today();
  const alreadyBurpedToday = bin.burps.includes(t);

  const missed = status === "burping" && !!bin.fillDate && (() => {
    const daysCured = getDaysCured(bin);
    for (let i = 1; i < daysCured; i++) {
      const d = new Date(bin.fillDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const ds = d.toISOString().split("T")[0];
      if (!bin.burps.includes(ds)) return true;
    }
    return false;
  })();

  const qualityBadge = bin.quality === "tops"
    ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-900/50 text-emerald-300 border-emerald-700/40 font-medium">TOPS</span>
    : bin.quality === "lowers"
    ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-900/50 text-amber-300 border-amber-700/40 font-medium">LOWERS</span>
    : <span className="text-[10px] px-2 py-0.5 rounded-full border bg-[#1a1a1a] text-[#c5b08a] border-[#2a2418] font-medium">MID</span>;

  return (
    <div className={`bg-[#111111] border rounded-2xl p-4 ${missed ? "border-red-900/60" : "border-[#2a2418]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[#f5f5f0] font-semibold text-sm leading-tight truncate">
            {getStrainName(bin.strainCode)}
          </div>
          <div className="text-[#6a5a3a] text-[10px] mt-0.5">{bin.strainCode}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {qualityBadge}
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-[#1a1a1a] text-[#c5b08a] border-[#2a2418] font-medium">
            {bin.size === "half" ? "HALF" : "FULL"}
          </span>
          {missed && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-red-900/40 text-red-400 border-red-800/40 font-medium">MISSED</span>
          )}
        </div>
      </div>

      <div className="text-[#6a5a3a] text-[10px] mt-2">
        {bin.dateHung && <span>Hung {fmtDate(bin.dateHung)} · </span>}
        {bin.fillDate ? <>Filled {fmtDate(bin.fillDate)} · {days}d cured</> : <span className="text-[#4a3a22]">No fill date · {days}d cured</span>}
      </div>

      {status === "burping" && (
        <>
          <BurpDots fillDate={bin.fillDate} burps={bin.burps} />
          <div className="flex items-center justify-between mt-3 gap-2">
            {alreadyBurpedToday ? (
              <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                <Check size={12} /> Burped today
              </span>
            ) : (
              <button
                onClick={() => onBurp(bin.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#2a1f00] text-amber-200 border border-[#3a2e00] hover:bg-[#3a2e0a] transition-colors">
                Burp Today
              </button>
            )}
            <button
              onClick={onSend}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#6a5a3a] border border-[#2a2418] hover:text-[#c5b08a] hover:border-[#2a2418] transition-colors">
              Send Downstairs
            </button>
          </div>
        </>
      )}

      {status === "curing" && (
        <div className="flex justify-end mt-3">
          <button
            onClick={onSend}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#6a5a3a] border border-[#2a2418] hover:text-[#c5b08a] hover:border-[#2a2418] transition-colors">
            Send Downstairs
          </button>
        </div>
      )}
    </div>
  );
}

function AddBinModal({ archive, onClose, onSave }) {
  const [mode, setMode] = useState("rack");
  // rack mode
  const [selectedRackId, setSelectedRackId] = useState(archive[0]?.id ?? "");
  // standalone mode
  const [saStrain, setSaStrain] = useState(STRAINS[0]?.code ?? "");
  const [saQuality, setSaQuality] = useState("lowers");
  const [saDateHung, setSaDateHung] = useState("");
  // shared
  const [size, setSize] = useState("full");
  const [fillDate, setFillDate] = useState("");

  const selectedRack = archive.find(r => r.id === selectedRackId);
  const canSave = mode === "rack" ? !!selectedRack : !!saStrain;

  function handleSave() {
    if (!canSave) return;
    if (mode === "rack") {
      onSave({
        strainCode: selectedRack.strainCode,
        quality: selectedRack.quality,
        dateHung: selectedRack.dateHung,
        fillDate: fillDate || null,
        size,
      });
    } else {
      onSave({
        strainCode: saStrain,
        quality: saQuality,
        dateHung: saDateHung || null,
        fillDate: fillDate || null,
        size,
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#111111] border border-[#2a2418] rounded-t-3xl w-full max-w-sm p-6 pb-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[#f5f5f0] font-semibold">Add Bin</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} className="text-[#6a5a3a]" /></button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          {[["rack", "From Rack"], ["standalone", "Standalone"]].map(([val, label]) => (
            <button key={val} onClick={() => setMode(val)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                mode === val
                  ? "bg-[#2a1f00] border-amber-600 text-amber-300"
                  : "bg-[#111111] border-[#2a2418] text-[#6a5a3a]"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {mode === "rack" ? (
          <>
            <div>
              <label className="text-xs text-[#c5b08a] mb-1 block">Source Rack</label>
              {archive.length === 0 ? (
                <div className="text-[#6a5a3a] text-xs py-2">No archived racks yet — bin a rack in the Hanging tab first.</div>
              ) : (
                <select
                  value={selectedRackId}
                  onChange={e => setSelectedRackId(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-amber-500">
                  {archive.map(r => (
                    <option key={r.id} value={r.id}>
                      {getStrainName(r.strainCode)} · {r.quality} · {fmtDate(r.dateHung)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedRack && (
              <div className="bg-[#1a1a1a] rounded-xl px-3 py-2 text-[11px] text-[#6a5a3a] space-y-0.5">
                <div>Strain: <span className="text-[#c5b08a]">{getStrainName(selectedRack.strainCode)}</span></div>
                <div>Quality: <span className="text-[#c5b08a] capitalize">{selectedRack.quality}</span></div>
                <div>Hung: <span className="text-[#c5b08a]">{fmtDate(selectedRack.dateHung)}</span></div>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="text-xs text-[#c5b08a] mb-1 block">Strain</label>
              <select value={saStrain} onChange={e => setSaStrain(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-amber-500">
                {STRAINS.map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#c5b08a] mb-1 block">Quality</label>
              <div className="flex gap-2">
                {QUALITY_ORDER.map(q => (
                  <button key={q} onClick={() => setSaQuality(q)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors capitalize ${
                      saQuality === q
                        ? "bg-[#2a1f00] border-amber-600 text-amber-300"
                        : "bg-[#111111] border-[#2a2418] text-[#6a5a3a]"
                    }`}>
                    {QUALITY_LABELS[q]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#c5b08a] mb-1 block">Date Hung <span className="text-[#6a5a3a]">(optional)</span></label>
              <input type="date" value={saDateHung} onChange={e => setSaDateHung(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-amber-500" />
            </div>
          </>
        )}

        <div>
          <label className="text-xs text-[#c5b08a] mb-1 block">Size</label>
          <div className="flex gap-2">
            {["full", "half"].map(s => (
              <button key={s} onClick={() => setSize(s)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  size === s
                    ? "bg-emerald-900/60 text-emerald-300 border-emerald-700"
                    : "bg-[#111111] text-[#6a5a3a] border-[#2a2418] hover:border-[#2a2418]"
                }`}>
                {s === "full" ? "Full Tote" : "Half Tote"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-[#c5b08a] mb-1 block">Fill Date <span className="text-[#6a5a3a]">(optional)</span></label>
          <input type="date" value={fillDate} onChange={e => setFillDate(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-amber-500" />
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-semibold transition-colors mt-2">
          Add Bin
        </button>
      </div>
    </div>
  );
}

function SendDownstairsModal({ bin, harvests, onClose, onSend }) {
  const [mode, setMode] = useState(harvests.length > 0 ? "existing" : "new");
  const [selectedHarvestId, setSelectedHarvestId] = useState(harvests[0]?.id ?? "");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const canSend = mode === "existing" ? !!selectedHarvestId : (!!startDate && !!endDate);

  function harvestLabel(h) {
    return h.name
      ? `${h.name} (${fmtDate(h.startDate)} – ${fmtDate(h.endDate)})`
      : `${fmtDate(h.startDate)} – ${fmtDate(h.endDate)}`;
  }

  function handleSend() {
    if (!canSend) return;
    if (mode === "existing") {
      onSend(bin.id, selectedHarvestId);
    } else {
      onSend(bin.id, { id: uid(), name: name.trim(), startDate, endDate });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#111111] border border-[#2a2418] rounded-t-3xl w-full max-w-sm p-6 pb-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[#f5f5f0] font-semibold">Send Downstairs</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} className="text-[#6a5a3a]" /></button>
        </div>

        <div className="text-[#6a5a3a] text-xs">
          {getStrainName(bin.strainCode)} · {bin.quality}{bin.dateHung ? ` · hung ${fmtDate(bin.dateHung)}` : ""}{bin.fillDate ? ` · filled ${fmtDate(bin.fillDate)}` : ""}
        </div>

        {harvests.length > 0 && (
          <div className="flex gap-2">
            {[["existing", "Existing Harvest"], ["new", "New Harvest"]].map(([v, label]) => (
              <button key={v} onClick={() => setMode(v)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  mode === v
                    ? "bg-[#2a1f00] text-amber-300 border-[#3a2e00]"
                    : "bg-[#111111] text-[#6a5a3a] border-[#2a2418] hover:border-[#2a2418]"
                }`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "existing" && (
          <div>
            <label className="text-xs text-[#c5b08a] mb-1 block">Harvest</label>
            <select
              value={selectedHarvestId}
              onChange={e => setSelectedHarvestId(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-amber-500">
              {harvests.map(h => (
                <option key={h.id} value={h.id}>{harvestLabel(h)}</option>
              ))}
            </select>
          </div>
        )}

        {mode === "new" && (
          <>
            <div>
              <label className="text-xs text-[#c5b08a] mb-1 block">Harvest Name (optional)</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Spring Run"
                className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none focus:border-amber-500" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-[#c5b08a] mb-1 block">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-amber-500" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[#c5b08a] mb-1 block">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-amber-500" />
              </div>
            </div>
          </>
        )}

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-semibold transition-colors mt-2">
          Send Downstairs
        </button>
      </div>
    </div>
  );
}

function HarvestCard({ harvest, bins }) {
  const [open, setOpen] = useState(false);
  const label = harvest.name
    ? `${harvest.name} · ${fmtDate(harvest.startDate)} – ${fmtDate(harvest.endDate)}`
    : `${fmtDate(harvest.startDate)} – ${fmtDate(harvest.endDate)}`;
  const strainSummary = [...new Set(bins.map(b => getStrainName(b.strainCode)))].join(", ");

  const qualityBadge = (q) => q === "tops"
    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-emerald-900/50 text-emerald-300 border-emerald-700/40 font-medium">TOPS</span>
    : q === "lowers"
    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-900/50 text-amber-300 border-amber-700/40 font-medium">LOWERS</span>
    : <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-[#1a1a1a] text-[#c5b08a] border-[#2a2418] font-medium">MID</span>;

  return (
    <div className="bg-[#111111] border border-[#2a2418] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left">
        <div>
          <div className="text-[#f5f5f0] text-sm font-medium">{label}</div>
          <div className="text-[#6a5a3a] text-[10px] mt-0.5">
            {bins.length} bin{bins.length !== 1 ? "s" : ""}
            {strainSummary && ` · ${strainSummary}`}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-[#6a5a3a] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-[#2a2418] divide-y divide-[#2a2418]">
          {bins.map(b => (
            <div key={b.id} className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[#f5f5f0] text-xs font-medium truncate">{getStrainName(b.strainCode)}</div>
                <div className="text-[#6a5a3a] text-[10px] mt-0.5">
                  {b.dateHung && <span>Hung {fmtDate(b.dateHung)} · </span>}
                  {b.fillDate ? `Filled ${fmtDate(b.fillDate)} · ` : ""}{getDaysCured(b)}d cured · {b.size === "half" ? "Half" : "Full"} tote
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {qualityBadge(b.quality)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BinsPanel({ data, persist }) {
  const [view, setView] = useState("active");
  const [showAdd, setShowAdd] = useState(false);
  const [sendingBin, setSendingBin] = useState(null);

  const bins = data.bins ?? [];
  const harvests = data.harvests ?? [];
  const rackArchive = data.archive ?? [];

  const activeBins = useMemo(() => bins.filter(b => !b.harvestId), [bins]);
  const archivedBins = useMemo(() => bins.filter(b => b.harvestId), [bins]);

  const emptyBinTiers = new Set(
    QUALITY_ORDER.filter(q => !activeBins.some(b => b.quality === q))
  );
  const [collapsedBinQuality, setCollapsedBinQuality] = useState(emptyBinTiers);
  useEffect(() => {
    setCollapsedBinQuality(prev => {
      const next = new Set(prev);
      let changed = false;
      QUALITY_ORDER.forEach(q => {
        if (next.has(q) && activeBins.some(b => b.quality === q)) {
          next.delete(q);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [activeBins]);

  const toggleBinQuality = useCallback(q => {
    setCollapsedBinQuality(prev => {
      const next = new Set(prev);
      next.has(q) ? next.delete(q) : next.add(q);
      return next;
    });
  }, []);

  function handleAddBin(fields) {
    persist(prev => ({
      ...prev,
      bins: [...(prev.bins ?? []), {
        id: uid(),
        ...fields,
        burps: [],
        harvestId: null,
        dateSent: null,
      }],
    }));
  }

  function handleBurp(binId) {
    const t = today();
    persist(prev => ({
      ...prev,
      bins: (prev.bins ?? []).map(b =>
        b.id === binId && !b.burps.includes(t)
          ? { ...b, burps: [...b.burps, t] }
          : b
      ),
    }));
  }

  function handleSend(binId, harvestOrId) {
    const t = today();
    persist(prev => {
      let nextHarvests = prev.harvests ?? [];
      let harvestId;
      if (typeof harvestOrId === "string") {
        harvestId = harvestOrId;
      } else {
        nextHarvests = [...nextHarvests, harvestOrId];
        harvestId = harvestOrId.id;
      }
      return {
        ...prev,
        harvests: nextHarvests,
        bins: (prev.bins ?? []).map(b =>
          b.id === binId ? { ...b, harvestId, dateSent: t } : b
        ),
      };
    });
  }

  return (
    <div>
      {/* Sub-tab toggle */}
      <div className="flex gap-1 mb-4">
        {["active", "archive"].map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              view === v
                ? "bg-[#2a1f00] text-amber-300 border border-[#3a2e00]"
                : "text-[#6a5a3a] hover:text-[#c5b08a] border border-transparent"
            }`}>
            {v}
          </button>
        ))}
      </div>

      {view === "active" && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#c5b08a] text-xs font-medium">
              {activeBins.length} bin{activeBins.length !== 1 ? "s" : ""} active
            </span>
            <button onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#2a1f00] text-amber-200 border border-[#3a2e00] hover:bg-[#3a2e0a] transition-colors">
              + Add Bin
            </button>
          </div>

          {activeBins.length === 0 ? (
            <div className="bg-[#111111] border border-[#2a2418] rounded-2xl p-8 text-center">
              <div className="text-[#c5b08a] text-sm font-medium mb-1">No bins active</div>
              <div className="text-[#6a5a3a] text-xs">Tap + Add Bin to log a tote.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {QUALITY_ORDER.map(quality => {
                const qBins = activeBins.filter(b => b.quality === quality);
                const isCollapsed = collapsedBinQuality.has(quality);
                const { text: qText, border: qBorder } = QUALITY_COLORS[quality];

                const burping = qBins.filter(b => getBinStatus(b) === "burping");
                const curing  = qBins.filter(b => getBinStatus(b) === "curing");

                return (
                  <div key={quality} className={`rounded-xl border ${qBorder} overflow-hidden`}>
                    <button
                      onClick={() => toggleBinQuality(quality)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-[#111111]"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-widest ${qText}`}>
                          {QUALITY_LABELS[quality]}
                        </span>
                        <span className="text-[10px] text-[#6a5a3a]">
                          {qBins.length} bin{qBins.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <svg
                        className={`w-3.5 h-3.5 text-[#6a5a3a] transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {!isCollapsed && (
                      <div className="px-3 pb-3 space-y-4 pt-2">
                        {burping.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wide font-medium px-1">Burping</div>
                            {burping.map(b => (
                              <BinCard key={b.id} bin={b} onBurp={handleBurp} onSend={() => setSendingBin(b)} />
                            ))}
                          </div>
                        )}
                        {curing.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wide font-medium px-1">Curing</div>
                            {curing.map(b => (
                              <BinCard key={b.id} bin={b} onBurp={handleBurp} onSend={() => setSendingBin(b)} />
                            ))}
                          </div>
                        )}
                        {qBins.length === 0 && (
                          <div className="text-center text-[#555] text-xs py-2">No bins</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {view === "archive" && (
        harvests.length === 0 ? (
          <div className="bg-[#111111] border border-[#2a2418] rounded-2xl p-8 text-center">
            <div className="text-[#c5b08a] text-sm font-medium mb-1">No archived harvests</div>
            <div className="text-[#6a5a3a] text-xs">Bins sent downstairs will appear here.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {[...harvests].reverse().map(h => (
              <HarvestCard
                key={h.id}
                harvest={h}
                bins={archivedBins.filter(b => b.harvestId === h.id)}
              />
            ))}
          </div>
        )
      )}

      {showAdd && (
        <AddBinModal archive={rackArchive} onClose={() => setShowAdd(false)} onSave={handleAddBin} />
      )}
      {sendingBin && (
        <SendDownstairsModal
          bin={sendingBin}
          harvests={harvests}
          onClose={() => setSendingBin(null)}
          onSend={handleSend}
        />
      )}
    </div>
  );
}
