// src/DryRoomTab.jsx
import { useState, useEffect, useCallback, useRef } from "react";
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

  const mainCount    = data.active.filter(b => b.rackType === "main").length;
  const sideCount    = data.active.filter(b => b.rackType === "side").length;
  const overdueCount = data.active.filter(b => daysRemaining(b.dateHung) <= 0).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-4 pt-2 pb-1">
        {syncing && <Loader2 size={12} className="text-zinc-500 animate-spin" />}
        {!syncing && synced && !syncError && <Wifi size={12} className="text-emerald-500" />}
        {syncError && <><WifiOff size={12} className="text-red-400" /><span className="text-[10px] text-red-400">{syncError}</span></>}
      </div>

      <div className="flex gap-1 px-4 pb-3">
        {DRY_ROOM_SUB_TABS.map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              subTab === t
                ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                : "text-zinc-500 hover:text-zinc-300 border border-transparent"
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {subTab === "Hanging" && (
          <HangingPanel active={data.active} mainCount={mainCount} sideCount={sideCount}
            overdueCount={overdueCount} onAdd={addBatch} onBin={binBatch} />
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

  function handleSave() {
    if (!strainCode || !dateHung) return;
    const fields = { strainCode, quality, rackType, dateHung, note: note.trim() };
    for (let i = 0; i < count; i++) onSave(fields);
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
            <select value={strainCode} onChange={e => setStrainCode(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-600">
              {STRAINS.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
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
                  }`}>
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
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {/* Date hung */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Date Hung</label>
            <input type="date" value={dateHung} onChange={e => setDateHung(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-600" />
          </div>
          {/* Note */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. top shelf"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600" />
          </div>
          {/* Number of racks */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Number of Racks</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setCount(c => Math.max(1, c - 1))}
                className="w-10 h-10 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors text-lg font-medium flex items-center justify-center">
                −
              </button>
              <span className="text-white font-semibold text-lg w-6 text-center">{count}</span>
              <button onClick={() => setCount(c => Math.min(22, c + 1))}
                className="w-10 h-10 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors text-lg font-medium flex items-center justify-center">
                +
              </button>
            </div>
          </div>
          <button onClick={handleSave}
            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl py-3 text-sm font-semibold transition-colors mt-2">
            {count === 1 ? "Add Batch" : `Add ${count} Batches`}
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchCard({ batch, onBin }) {
  const [confirming, setConfirming] = useState(false);
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm leading-tight truncate">{getStrainName(batch.strainCode)}</div>
          <div className="text-zinc-600 text-[10px] mt-0.5">{batch.strainCode}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {qualityBadge}
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-sky-900/30 text-sky-400 border-sky-800/40 font-medium capitalize">{batch.rackType}</span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div>
          <div className="text-zinc-500 text-[10px]">Hung {fmtDate(batch.dateHung)} · {hanging}d hanging</div>
          <div className={`text-xs font-semibold mt-0.5 ${color}`}>
            {overdue ? `OVERDUE by ${Math.abs(remaining)}d` : `${remaining}d remaining`}
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
      {batch.note && <div className="mt-2 text-zinc-500 text-[10px] italic">{batch.note}</div>}
    </div>
  );
}

function HangingPanel({ active, mainCount, sideCount, overdueCount, onAdd, onBin }) {
  const [showAdd, setShowAdd] = useState(false);
  const sorted = sortByUrgency(active);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-300 text-xs font-medium">
            {active.length} batch{active.length !== 1 ? "es" : ""} hanging
          </span>
          <span className="text-zinc-600 text-[10px]">·</span>
          <span className="text-zinc-500 text-[10px]">{mainCount} main · {sideCount} side</span>
          {overdueCount > 0 && (
            <><span className="text-zinc-600 text-[10px]">·</span>
            <span className="text-red-400 text-[10px] font-semibold">{overdueCount} overdue</span></>
          )}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-800 text-emerald-200 border border-emerald-700 hover:bg-emerald-700 transition-colors">
          + Add Batch
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="text-zinc-400 text-sm font-medium mb-1">Nothing hanging</div>
          <div className="text-zinc-600 text-xs">Tap + Add Batch to log today&apos;s harvest.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(b => <BatchCard key={b.id} batch={b} onBin={onBin} />)}
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
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600" />
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
              <div key={b.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{getStrainName(b.strainCode)}</div>
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
                  {totalDays !== null && <><span className="text-zinc-700">·</span><span>{totalDays}d dried</span></>}
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

function BurpDots({ fillDate, burps }) {
  const todayStr = today();

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
              burped ? "bg-emerald-500" : isPast ? "bg-red-800/70" : "bg-zinc-700"
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

  const missed = (() => {
    if (status !== "burping") return false;
    const now = new Date();
    const yStr = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
    ).toISOString().split("T")[0];
    return yStr > bin.fillDate && !bin.burps.includes(yStr);
  })();

  const qualityBadge = bin.quality === "tops"
    ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-900/50 text-emerald-300 border-emerald-700/40 font-medium">TOPS</span>
    : bin.quality === "lowers"
    ? <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-900/50 text-amber-300 border-amber-700/40 font-medium">LOWERS</span>
    : <span className="text-[10px] px-2 py-0.5 rounded-full border bg-zinc-800 text-zinc-400 border-zinc-700 font-medium">MID</span>;

  return (
    <div className={`bg-zinc-900 border rounded-2xl p-4 ${missed ? "border-red-900/60" : "border-zinc-800"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm leading-tight truncate">
            {getStrainName(bin.strainCode)}
          </div>
          <div className="text-zinc-600 text-[10px] mt-0.5">{bin.strainCode}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {qualityBadge}
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-zinc-800 text-zinc-400 border-zinc-700 font-medium">
            {bin.size === "half" ? "HALF" : "FULL"}
          </span>
          {missed && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-red-900/40 text-red-400 border-red-800/40 font-medium">MISSED</span>
          )}
        </div>
      </div>

      <div className="text-zinc-500 text-[10px] mt-2">
        Filled {fmtDate(bin.fillDate)} · {days}d cured
      </div>

      {status === "burping" && (
        <>
          <BurpDots fillDate={bin.fillDate} burps={bin.burps} />
          <div className="flex items-center justify-between mt-3 gap-2">
            {alreadyBurpedToday ? (
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                <Check size={12} /> Burped today
              </span>
            ) : (
              <button
                onClick={() => onBurp(bin.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-800 text-emerald-200 border border-emerald-700 hover:bg-emerald-700 transition-colors">
                Burp Today
              </button>
            )}
            <button
              onClick={onSend}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600 transition-colors">
              Send Downstairs
            </button>
          </div>
        </>
      )}

      {status === "curing" && (
        <div className="flex justify-end mt-3">
          <button
            onClick={onSend}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600 transition-colors">
            Send Downstairs
          </button>
        </div>
      )}
    </div>
  );
}

function AddBinModal({ archive, onClose, onSave }) {
  const [selectedRackId, setSelectedRackId] = useState(archive[0]?.id ?? "");
  const [size, setSize] = useState("full");
  const [fillDate, setFillDate] = useState(today());

  const selectedRack = archive.find(r => r.id === selectedRackId);

  function handleSave() {
    if (!selectedRack) return;
    onSave({
      strainCode: selectedRack.strainCode,
      quality: selectedRack.quality,
      dateHung: selectedRack.dateHung,
      fillDate,
      size,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-t-3xl w-full max-w-sm p-6 pb-10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold">Add Bin</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} className="text-zinc-500" /></button>
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Source Rack</label>
          {archive.length === 0 ? (
            <div className="text-zinc-600 text-xs py-2">No archived racks yet — bin a rack in the Hanging tab first.</div>
          ) : (
            <select
              value={selectedRackId}
              onChange={e => setSelectedRackId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-600">
              {archive.map(r => (
                <option key={r.id} value={r.id}>
                  {getStrainName(r.strainCode)} · {r.quality} · {fmtDate(r.dateHung)}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedRack && (
          <div className="bg-zinc-900 rounded-xl px-3 py-2 text-[11px] text-zinc-500 space-y-0.5">
            <div>Strain: <span className="text-zinc-300">{getStrainName(selectedRack.strainCode)}</span></div>
            <div>Quality: <span className="text-zinc-300 capitalize">{selectedRack.quality}</span></div>
            <div>Hung: <span className="text-zinc-300">{fmtDate(selectedRack.dateHung)}</span></div>
          </div>
        )}

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Size</label>
          <div className="flex gap-2">
            {["full", "half"].map(s => (
              <button key={s} onClick={() => setSize(s)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  size === s
                    ? "bg-emerald-900/60 text-emerald-300 border-emerald-700"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600"
                }`}>
                {s === "full" ? "Full Tote" : "Half Tote"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Fill Date</label>
          <input type="date" value={fillDate} onChange={e => setFillDate(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-600" />
        </div>

        <button
          onClick={handleSave}
          disabled={!selectedRack}
          className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-semibold transition-colors mt-2">
          Add Bin
        </button>
      </div>
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

  const activeBins = bins.filter(b => !b.harvestId);
  const burpingBins = activeBins.filter(b => getBinStatus(b) === "burping");
  const curingBins  = activeBins.filter(b => getBinStatus(b) === "curing");
  const archivedBins = bins.filter(b => b.harvestId);

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
                ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                : "text-zinc-500 hover:text-zinc-300 border border-transparent"
            }`}>
            {v}
          </button>
        ))}
      </div>

      {view === "active" && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-300 text-xs font-medium">
              {activeBins.length} bin{activeBins.length !== 1 ? "s" : ""} active
            </span>
            <button onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-800 text-emerald-200 border border-emerald-700 hover:bg-emerald-700 transition-colors">
              + Add Bin
            </button>
          </div>

          {burpingBins.length > 0 && (
            <>
              <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wide mb-2">Burping</div>
              <div className="space-y-3 mb-4">
                {burpingBins.map(b => (
                  <BinCard key={b.id} bin={b} onBurp={handleBurp} onSend={() => setSendingBin(b)} />
                ))}
              </div>
            </>
          )}

          {curingBins.length > 0 && (
            <>
              <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wide mb-2">Curing</div>
              <div className="space-y-3 mb-4">
                {curingBins.map(b => (
                  <BinCard key={b.id} bin={b} onBurp={handleBurp} onSend={() => setSendingBin(b)} />
                ))}
              </div>
            </>
          )}

          {activeBins.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="text-zinc-400 text-sm font-medium mb-1">No bins active</div>
              <div className="text-zinc-600 text-xs">Tap + Add Bin to log a tote.</div>
            </div>
          )}
        </>
      )}

      {view === "archive" && (
        <div className="text-zinc-600 text-xs text-center py-8">Archive view — coming in next task.</div>
      )}

      {showAdd && (
        <AddBinModal archive={rackArchive} onClose={() => setShowAdd(false)} onSave={handleAddBin} />
      )}
      {sendingBin && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center fixed inset-x-4 bottom-10 z-50">
          <div className="text-zinc-400 text-xs">SendDownstairsModal coming next.</div>
          <button onClick={() => setSendingBin(null)} className="text-zinc-600 text-xs mt-2 block mx-auto">Cancel</button>
        </div>
      )}
    </div>
  );
}
