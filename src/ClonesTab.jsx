import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { loadFromDB, saveToDB, subscribeToKey } from "./supabase";
import { Badge, Modal, StatBox } from "./shared";
import {
  uid, today, fmtDate, daysSince,
  TESTER_CODES, STATUS_COLORS, ROUND_COLORS, STATUSES,
  STRAIN_PALETTE, CLONE_SUB_TABS, TRAY_ALERT_DAYS,
  resolveCode, parseSmartEntry, autoTrayCode, getAlertTrays,
  calcSurvivalByStrain, buildTransplantPipeline, filterAndGroupPlants,
  buildStrainColorMap, applyTrayTransplant, searchPlants, groupByStrain,
} from "./clones-utils";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Search from "lucide-react/dist/esm/icons/search";
import Download from "lucide-react/dist/esm/icons/download";

// ── Storage (localStorage cache) ─────────────────────────────────────────────
function load(key) {
  try { const val = localStorage.getItem(key); return val ? JSON.parse(val) : null; } catch { return null; }
}
function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

function normTs(ts) { try { return ts ? new Date(ts).toISOString() : null; } catch { return ts; } }

// ── Default strains (used as initial state before DB load) ───────────────────
const DEFAULT_STRAINS = [
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

// Badge, Modal imported from ./shared
// StatBox imported from ./shared (colorClass prop — see usages below)

function RoundPanel({ title, plants, colorClass }) {
  const grouped = plants.reduce((a, p) => { a[p.strainName] = (a[p.strainName] || 0) + 1; return a; }, {});
  const cc = { green: "text-amber-400", sky: "text-sky-400" };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider">{title}</div>
        <Badge label={`${plants.length} plants`} colorClass={colorClass} />
      </div>
      {plants.length === 0
        ? <div className="bg-[#111111] border border-[#2a2418] rounded-xl p-4 text-xs text-[#6a5a3a] text-center">No plants</div>
        : (
          <div className="bg-[#111111] border border-[#2a2418] rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 gap-px bg-[#1a1a1a]">
              {[["Cloned", "green"], ["Transplanted", "sky"]].map(([s, c]) => (
                <div key={s} className="bg-[#111111] p-2.5 text-center">
                  <div className={`text-lg font-bold ${cc[c]}`}>{plants.filter(p => p.status === s).length}</div>
                  <div className="text-[9px] text-[#6a5a3a] leading-tight">{s}</div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-[#2a2418]/50">
              {Object.entries(grouped).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => (
                <div key={name} className="px-4 py-2.5 flex justify-between">
                  <span className="text-xs text-[#c5b08a]">{name}</span>
                  <span className="text-xs text-[#6a5a3a]">{cnt}</span>
                </div>
              ))}
            </div>
          </div>
        )
      }
    </div>
  );
}

// ── Clone Batch Shortcut ─────────────────────────────────────────────────────
function CloneBatchShortcut({ strains, plants, onClone }) {
  const [strain, setStrain] = useState("");
  const [round, setRound] = useState("Upcoming");
  const template = strain ? plants.filter(p => p.strainName === strain && !p.archived) : [];
  const lastBatch = template.length > 0 ? template[0] : null;
  const batchSize = lastBatch
    ? plants.filter(p => p.strainName === lastBatch.strainName && p.dateCloned === lastBatch.dateCloned && !p.archived).length
    : 0;
  return (
    <div className="space-y-3">
      <select value={strain} onChange={e => setStrain(e.target.value)}
        className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-xs text-[#f5f5f0] focus:outline-none">
        <option value="">Select strain to repeat</option>
        {strains.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      {lastBatch && (
        <div className="bg-[#1a1a1a]/60 rounded-lg px-3 py-2 text-[10px] text-[#6a5a3a] flex justify-between">
          <span>Last batch: {fmtDate(lastBatch.dateCloned)}</span>
          <span className="text-[#c5b08a]">{batchSize} plants · {lastBatch.pot}</span>
        </div>
      )}
      <div className="flex gap-2">
        {["Upcoming", "Next"].map(r => (
          <button key={r} onClick={() => setRound(r)}
            className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${round === r ? "bg-teal-900/40 border-teal-600 text-teal-300" : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"}`}>{r}</button>
        ))}
      </div>
      <button onClick={() => { if (strain) onClone(strain, round); }} disabled={!strain}
        className="w-full bg-[#2a2418] hover:bg-[#222] disabled:opacity-40 text-[#f5f5f0] text-xs py-2.5 rounded-lg transition-colors">
        Clone {batchSize > 0 ? `${batchSize} plants` : "Batch"} into {round}
      </button>
    </div>
  );
}

// ── Import from Mother Log (JSON paste) ──────────────────────────────────────
function ImportFromMotherLog({ strains, plants, savePlants, onAdded }) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pot, setPot] = useState("Black Pot");
  const [round, setRound] = useState("Upcoming");

  function handleParse() {
    setError(""); setSuccess(""); setParsed(null);
    try {
      const data = JSON.parse(raw.trim());
      if (data.type !== "clone_import") { setError("Not a valid Mother Log export."); return; }
      if (!data.strainCode || !data.qty) { setError("Missing strain or quantity."); return; }
      setParsed(data);
    } catch { setError("Invalid JSON — copy the full JSON block from Mother Log."); }
  }

  function handleImport() {
    if (!parsed) return;
    const baseCode = parsed.strainCode.replace(/[a-z]+$/i, "");
    const suffix = parsed.strainCode.slice(baseCode.length).toUpperCase();
    const strain = strains.find(s => s.code === baseCode);
    const strainName = strain ? strain.name + (suffix ? ` ${suffix}` : "") : parsed.strainName || parsed.strainCode;
    const newPlants = Array.from({ length: parsed.qty }, () => ({
      id: uid(), strainCode: parsed.strainCode, strainName,
      dateCloned: parsed.dateCloned || null, dateTransplanted: null,
      pot, round, status: "Cloned",
      notes: "", batchNote: parsed.batchNote || "Imported from Mother Log",
      tray: "", archived: false,
    }));
    savePlants([...plants, ...newPlants]);
    setSuccess(`✓ ${parsed.qty} ${strainName} imported`);
    setRaw(""); setParsed(null);
    setTimeout(() => { setSuccess(""); onAdded?.(); }, 1500);
  }

  return (
    <div className="bg-[#111111] border border-[#2a2418] rounded-xl p-4 space-y-3">
      <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider">Import from Mother Log</div>
      <textarea value={raw} onChange={e => { setRaw(e.target.value); setParsed(null); setError(""); }}
        placeholder={'Paste JSON from Mother Log…\n{\n  "type": "clone_import",\n  "strainCode": "2023",\n  "qty": 10,\n  ...\n}'}
        rows={5}
        className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-xs text-[#c5b08a] placeholder-[#6a5a3a] focus:outline-none focus:border-amber-500 transition-colors resize-none font-mono" />
      {error && <div className="text-red-400 text-xs">{error}</div>}
      {success && <div className="text-amber-400 text-xs font-medium">{success}</div>}
      {parsed && (
        <div className="bg-[#2a1f00]/20 border border-[#3a2e00] rounded-xl px-4 py-3 space-y-1.5 text-xs">
          <div className="text-amber-300 font-semibold text-[10px] uppercase tracking-wider mb-1">Preview</div>
          <div className="flex justify-between"><span className="text-[#6a5a3a]">Strain</span><span className="text-[#f5f5f0]">{parsed.strainName}</span></div>
          <div className="flex justify-between"><span className="text-[#6a5a3a]">Quantity</span><span className="text-amber-300 font-bold">{parsed.qty} plants</span></div>
          {parsed.dateCloned && <div className="flex justify-between"><span className="text-[#6a5a3a]">Date Cloned</span><span className="text-[#f5f5f0]">{fmtDate(parsed.dateCloned)}</span></div>}
          {parsed.batchNote && <div className="flex justify-between"><span className="text-[#6a5a3a]">Note</span><span className="text-[#c5b08a] truncate ml-4 text-right">{parsed.batchNote}</span></div>}
        </div>
      )}
      {parsed && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-[#6a5a3a] mb-1.5">Pot</div>
            <div className="flex flex-col gap-1">
              {["Black Pot", "Green Pot"].map(p => (
                <button key={p} onClick={() => setPot(p)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors ${pot === p ? "bg-[#2a1f00] border-amber-600 text-amber-300" : "bg-[#1a1a1a] border-[#2a2418] text-[#c5b08a]"}`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#6a5a3a] mb-1.5">Round</div>
            <div className="flex flex-col gap-1">
              {["Upcoming", "Next"].map(r => (
                <button key={r} onClick={() => setRound(r)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors ${round === r ? "bg-teal-900/40 border-teal-600 text-teal-300" : "bg-[#1a1a1a] border-[#2a2418] text-[#c5b08a]"}`}>{r}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      {!parsed
        ? <button onClick={handleParse} disabled={!raw.trim()}
            className="w-full bg-[#2a2418] hover:bg-[#222] disabled:opacity-40 text-[#f5f5f0] text-xs font-medium py-2.5 rounded-lg transition-colors">
            Parse JSON
          </button>
        : <button onClick={handleImport}
            className="w-full bg-amber-600 hover:bg-amber-500 text-[#f5f5f0] text-xs font-semibold py-3 rounded-xl transition-colors">
            ✓ Import {parsed.qty} Plants
          </button>
      }
    </div>
  );
}

// ── Manual Entry ─────────────────────────────────────────────────────────────
function ManualEntry({ strains, plants, savePlants, onAdded }) {
  const [qty, setQty] = useState(1);
  const [code, setCode] = useState("");
  const [suffix, setSuffix] = useState("");
  const [date, setDate] = useState(today());
  const [pot, setPot] = useState("Black Pot");
  const [round, setRound] = useState("Upcoming");
  const [note, setNote] = useState("");

  function handleAdd() {
    if (!code) return;
    const strain = strains.find(s => s.code === code);
    if (!strain) return;
    const newPlants = Array.from({ length: qty }, () => ({
      id: uid(), strainCode: code + suffix,
      strainName: strain.name + (suffix ? ` ${suffix.toUpperCase()}` : ""),
      dateCloned: date, dateTransplanted: null,
      pot, round, status: "Cloned",
      notes: note, batchNote: note, tray: "", archived: false,
    }));
    savePlants([...plants, ...newPlants]);
    setQty(1); setCode(""); setSuffix(""); setNote("");
    onAdded?.();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="number" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} min={1}
          className="w-16 bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-xs text-[#f5f5f0] focus:outline-none" />
        <select value={code} onChange={e => { setCode(e.target.value); setSuffix(""); }}
          className="flex-1 bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-2 py-2 text-xs text-[#f5f5f0] focus:outline-none">
          <option value="">Select strain</option>
          {strains.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
        </select>
        {TESTER_CODES.includes(code) && (
          <input value={suffix} onChange={e => setSuffix(e.target.value)} maxLength={2} placeholder="a/b/c"
            className="w-12 bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-2 py-2 text-xs text-[#f5f5f0] focus:outline-none text-center" />
        )}
      </div>
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-xs text-[#f5f5f0] focus:outline-none" />
      <div className="flex gap-2">
        {["Black Pot", "Green Pot"].map(p => (
          <button key={p} onClick={() => setPot(p)}
            className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${pot === p ? "bg-[#2a1f00] border-amber-600 text-amber-300" : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"}`}>{p}</button>
        ))}
      </div>
      <div className="flex gap-2">
        {["Upcoming", "Next"].map(r => (
          <button key={r} onClick={() => setRound(r)}
            className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${round === r ? "bg-teal-900/40 border-teal-600 text-teal-300" : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"}`}>{r}</button>
        ))}
      </div>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Batch note (optional)"
        className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-xs text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none" />
      <button onClick={handleAdd}
        className="w-full bg-[#2a2418] hover:bg-[#222] text-[#f5f5f0] text-xs py-2.5 rounded-lg transition-colors">Add to Log</button>
    </div>
  );
}

// ── Tray Manager ─────────────────────────────────────────────────────────────
function TrayManager({ trays, saveTrays, strains, plants, onTransplantTray, alertTrays }) {
  const [code, setCode] = useState("");
  const [strainCode, setStrainCode] = useState("");
  const [dateStarted, setDateStarted] = useState(today());
  const [count, setCount] = useState("");
  const [trayNote, setTrayNote] = useState("");
  const [error, setError] = useState("");
  const [transplantModal, setTransplantModal] = useState(null);
  const [transplantDate, setTransplantDate] = useState(today());
  const [transplantSurvived, setTransplantSurvived] = useState("");
  const [transplantRound, setTransplantRound] = useState("Next");
  const [collapsedStrains, setCollapsedStrains] = useState(new Set());

  function toggleStrainCollapse(strainName) {
    setCollapsedStrains(prev => {
      const n = new Set(prev);
      n.has(strainName) ? n.delete(strainName) : n.add(strainName);
      return n;
    });
  }

  function autoCode() { return autoTrayCode(trays, strainCode); }

  function handleAdd() {
    if (!code.trim()) { setError("Tray code required."); return; }
    if (!strainCode) { setError("Select a strain."); return; }
    if (trays.find(t => t.code === code.trim())) { setError("Code already exists."); return; }
    const strain = strains.find(s => s.code === strainCode);
    saveTrays([...trays, {
      id: uid(), code: code.trim().toUpperCase(), strainCode,
      strainName: strain?.name || strainCode,
      dateStarted, count: parseInt(count) || null,
      status: "Active", notes: trayNote,
    }]);
    setCode(""); setStrainCode(""); setCount(""); setTrayNote(""); setError("");
  }

  function setTrayStatus(id, status) { saveTrays(trays.map(t => t.id === id ? { ...t, status } : t)); }
  function deleteTray(id) { if (window.confirm("Remove tray?")) saveTrays(trays.filter(t => t.id !== id)); }

  const activeTrys = trays.filter(t => t.status === "Active");
  const doneTrys = trays.filter(t => t.status !== "Active");
  const isAlert = (t) => alertTrays.some(a => a.id === t.id);

  return (
    <div className="p-4 space-y-4">
      <div className="bg-[#111111] border border-[#2a2418] rounded-xl p-4 space-y-3">
        <div className="text-xs text-[#6a5a3a] font-medium">Log a Clone Tray</div>
        <select value={strainCode} onChange={e => { setStrainCode(e.target.value); setCode(""); }}
          className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-2 py-2 text-xs text-[#f5f5f0] focus:outline-none">
          <option value="">Select strain</option>
          {strains.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
        </select>
        <div className="flex gap-2">
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Tray code e.g. 2023-T1"
            className="flex-1 bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-xs text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none focus:border-amber-500" />
          {strainCode && (
            <button onClick={() => setCode(autoCode())}
              className="text-xs bg-[#2a2418] hover:bg-[#222] text-[#c5b08a] px-3 rounded-lg transition-colors">Auto</button>
          )}
        </div>
        <div className="flex gap-2">
          <input type="number" value={count} onChange={e => setCount(e.target.value)} min={1} placeholder="# of clones"
            className="flex-1 bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-xs text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none" />
          <input type="date" value={dateStarted} onChange={e => setDateStarted(e.target.value)}
            className="flex-1 bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-xs text-[#f5f5f0] focus:outline-none" />
        </div>
        <input value={trayNote} onChange={e => setTrayNote(e.target.value)} placeholder="Note (optional)"
          className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-xs text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none" />
        {error && <div className="text-red-400 text-xs">{error}</div>}
        <button onClick={handleAdd}
          className="w-full bg-amber-600 hover:bg-amber-500 text-[#f5f5f0] text-xs font-medium py-2.5 rounded-lg transition-colors">Add Tray</button>
      </div>

      {activeTrys.length > 0 && (
        <div>
          <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider mb-2">Active Trays</div>
          <div className="space-y-2">
            {(() => {
              // Group by strain name
              const groups = {};
              for (const t of activeTrys) {
                const key = t.strainName || t.strainCode;
                if (!groups[key]) groups[key] = [];
                groups[key].push(t);
              }
              return Object.entries(groups).map(([strainName, groupTrays]) => {
                const collapsed = collapsedStrains.has(strainName);
                const hasAlert = groupTrays.some(t => isAlert(t));
                const totalCount = groupTrays.reduce((s, t) => s + (t.count || 0), 0);
                const minDay = Math.min(...groupTrays.map(t => daysSince(t.dateStarted) ?? 0));
                const maxDay = Math.max(...groupTrays.map(t => daysSince(t.dateStarted) ?? 0));
                const dayLabel = groupTrays.length === 1
                  ? `Day ${daysSince(groupTrays[0].dateStarted) ?? "—"}`
                  : `Day ${minDay}–${maxDay}`;
                return (
                  <div key={strainName} className={`bg-[#111111] border rounded-xl overflow-hidden ${hasAlert ? "border-red-700/40" : "border-[#2a2418]"}`}>
                    {/* Collapsible header */}
                    <button
                      onClick={() => toggleStrainCollapse(strainName)}
                      className={`w-full px-4 py-3 flex items-center justify-between gap-2 ${hasAlert ? "bg-red-950/20" : "bg-[#1a1a1a]/60"}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-semibold truncate ${hasAlert ? "text-red-300" : "text-[#f5f5f0]"}`}>{strainName}</span>
                        {hasAlert && <span className="text-[10px] text-red-400 font-bold flex-shrink-0">⚠ OVERDUE</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-[10px]">
                        <span className={hasAlert ? "text-red-400 font-bold" : "text-[#6a5a3a]"}>{dayLabel}</span>
                        <span className="text-[#6a5a3a]">{groupTrays.length} tray{groupTrays.length > 1 ? "s" : ""}</span>
                        {totalCount > 0 && <span className="text-[#6a5a3a]">{totalCount} clones</span>}
                        <span className={`text-[#6a5a3a] transition-transform duration-150 ${collapsed ? "" : "rotate-180"}`}>▾</span>
                      </div>
                    </button>
                    {/* Tray rows */}
                    {!collapsed && (
                      <div className="divide-y divide-[#2a2418]/50">
                        {groupTrays.map(t => {
                          const days = daysSince(t.dateStarted);
                          const alert = isAlert(t);
                          const loggedCount = plants.filter(p => p.tray === t.code && !p.archived).length;
                          return (
                            <div key={t.id} className={`px-4 py-3 ${alert ? "bg-red-950/10" : ""}`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <span className={`text-sm font-bold ${alert ? "text-red-300" : "text-emerald-400"}`}>{t.code}</span>
                                </div>
                                <div className="flex gap-1.5 flex-shrink-0">
                                  <button onClick={() => { setTransplantModal(t); setTransplantDate(today()); }}
                                    className={`text-[10px] font-medium border rounded px-2 py-0.5 transition-colors ${alert ? "border-red-700/50 text-red-300 hover:bg-red-900/30" : "border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/20"}`}>
                                    Transplant
                                  </button>
                                  <button onClick={() => setTrayStatus(t.id, "Done")}
                                    className="text-[10px] text-[#6a5a3a] border border-[#2a2418] rounded px-2 py-0.5 hover:text-[#c5b08a] transition-colors">Done</button>
                                  <button onClick={() => deleteTray(t.id)}
                                    className="text-[10px] text-[#6a5a3a] hover:text-red-400 transition-colors px-1">✕</button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-3 text-[10px]">
                                <span className={`font-bold ${alert ? "text-red-400" : days >= 10 ? "text-amber-400" : "text-[#6a5a3a]"}`}>Day {days ?? "—"}</span>
                                <div className="flex-1 flex items-center gap-1.5 min-w-20">
                                  <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${alert ? "bg-red-500" : days >= 10 ? "bg-amber-500" : "bg-emerald-500"}`}
                                      style={{ width: `${Math.min(100, ((days || 0) / 14) * 100)}%` }} />
                                  </div>
                                  <span className="text-[#6a5a3a] text-[9px]">14</span>
                                </div>
                                {t.count && <span className="text-[#6a5a3a]">Cap: <span className="text-[#6a5a3a]">{t.count}</span></span>}
                                {loggedCount > 0 && <span className="text-[#6a5a3a]">Logged: <span className="text-amber-400">{loggedCount}</span></span>}
                                {t.notes && <span className="text-[#6a5a3a] italic">{t.notes}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {activeTrys.length === 0 && doneTrys.length === 0 && (
        <div className="text-center py-12 text-[#6a5a3a] text-sm">
          <div className="text-3xl mb-2">🪴</div>No trays logged yet.
        </div>
      )}

      {doneTrys.length > 0 && (
        <div>
          <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider mb-2">Done Trays</div>
          <div className="bg-[#111111] border border-[#2a2418] rounded-xl overflow-hidden divide-y divide-[#2a2418]/50">
            {doneTrys.map(t => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between opacity-50">
                <div>
                  <span className="text-xs font-bold text-[#6a5a3a]">{t.code}</span>
                  <span className="text-xs text-[#6a5a3a] ml-2">{t.strainName}</span>
                  {t.survived != null && t.count && (
                    <span className="text-xs text-[#6a5a3a] ml-2">{t.survived}/{t.count}</span>
                  )}
                  {t.survived != null && !t.count && (
                    <span className="text-xs text-[#6a5a3a] ml-2">{t.survived} survived</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setTrayStatus(t.id, "Active")}
                    className="text-[10px] text-[#6a5a3a] border border-[#2a2418] rounded px-2 py-0.5 hover:text-[#c5b08a] transition-colors">Reactivate</button>
                  <button onClick={() => deleteTray(t.id)}
                    className="text-[10px] text-[#6a5a3a] hover:text-red-400 transition-colors">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {transplantModal && (() => {
        const loggedCount = plants.filter(p => p.tray === transplantModal.code && p.status === "Cloned" && !p.archived).length;
        const survivedNum = transplantSurvived !== "" ? parseInt(transplantSurvived) : null;
        const effectiveSurvived = survivedNum ?? loggedCount;
        return (
          <Modal title={`Transplant ${transplantModal.code}`} onClose={() => setTransplantModal(null)}>
            <div className="space-y-4">
              <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-[#6a5a3a]">Strain</span><span className="text-[#f5f5f0]">{transplantModal.strainName}</span></div>
                {transplantModal.count && <div className="flex justify-between"><span className="text-[#6a5a3a]">Total in tray</span><span className="text-[#c5b08a]">{transplantModal.count}</span></div>}
                <div className="flex justify-between"><span className="text-[#6a5a3a]">Individually logged</span><span className="text-emerald-300">{loggedCount} plants</span></div>
              </div>
              <div>
                <label className="text-xs text-[#c5b08a] block mb-1.5">Survived</label>
                <input
                  type="number" min="0" max={transplantModal.count || undefined}
                  value={transplantSurvived}
                  onChange={e => setTransplantSurvived(e.target.value)}
                  placeholder={transplantModal.count ? `of ${transplantModal.count}` : "how many survived?"}
                  className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2.5 text-sm text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none focus:border-sky-500" />
                {survivedNum !== null && transplantModal.count && survivedNum < transplantModal.count && (
                  <div className="text-[10px] text-[#6a5a3a] mt-1">{transplantModal.count - survivedNum} did not survive</div>
                )}
              </div>
              <div>
                <label className="text-xs text-[#c5b08a] block mb-1.5">Round</label>
                <div className="flex gap-2">
                  {["Upcoming", "Next"].map(r => (
                    <button key={r} onClick={() => setTransplantRound(r)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${transplantRound === r ? "bg-teal-900/40 border-teal-600 text-teal-300" : "bg-[#111111] border-[#2a2418] text-[#6a5a3a]"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#c5b08a] block mb-1.5">Transplant Date</label>
                <input type="date" value={transplantDate} onChange={e => setTransplantDate(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-sm text-[#f5f5f0] focus:outline-none" />
              </div>
              <button
                onClick={() => {
                  onTransplantTray(transplantModal.code, transplantDate, survivedNum, transplantRound);
                  setTransplantModal(null);
                  setTransplantSurvived("");
                }}
                className="w-full bg-sky-700 hover:bg-sky-600 text-[#f5f5f0] font-semibold py-3 rounded-xl text-sm transition-colors">
                ✓ Transplant {effectiveSurvived > 0 ? `${effectiveSurvived} plants` : "All"}
              </button>
              <button onClick={() => { setTransplantModal(null); setTransplantSurvived(""); }} className="w-full text-[#6a5a3a] text-xs py-2">Cancel</button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// ── MAIN CLONES TAB ──────────────────────────────────────────────────────────
export default function ClonesTab() {
  const [tab, setTab] = useState("Summary");
  const [plants, setPlants] = useState([]);
  const [strains, setStrains] = useState(DEFAULT_STRAINS);
  const [trays, setTrays] = useState([]);

  // Smart entry
  const [smartInput, setSmartInput] = useState("");
  const [parsed, setParsed] = useState(null);
  const [entryPot, setEntryPot] = useState("Black Pot");
  const [entryRound, setEntryRound] = useState("Upcoming");
  const [entryNote, setEntryNote] = useState("");
  const [entryTray, setEntryTray] = useState("");
  const [entryStatus, setEntryStatus] = useState("Cloned");
  const [entryTransplantDate, setEntryTransplantDate] = useState("");
  const [entryError, setEntryError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Strain manager
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [strainError, setStrainError] = useState("");

  // Edit modal
  const [editPlant, setEditPlant] = useState(null);

  // Bulk
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("Transplanted");
  const [bulkRound, setBulkRound] = useState("");
  const [bulkDate, setBulkDate] = useState(today());

  // Filters
  const [filterStrain, setFilterStrain] = useState("All");
  const [filterRound, setFilterRound] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showArchived, setShowArchived] = useState(false);

  // Round promotion modal
  const [showPromoteModal, setShowPromoteModal] = useState(false);

  // Log view mode
  const [compactView, setCompactView] = useState(false);
  const [collapsedLogStrains, setCollapsedLogStrains] = useState(new Set());

  function toggleLogStrain(name) {
    setCollapsedLogStrains(prev => {
      const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n;
    });
  }

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Undo
  const [undoStack, setUndoStack] = useState([]);
  const [undoToast, setUndoToast] = useState(false);

  // Loading
  const [loading, setLoading] = useState(true);

  // Supabase sync
  const [syncStatus, setSyncStatus] = useState("syncing");
  const pendingTimestampsRef = useRef(new Set());
  const saveReadyRef = useRef(false);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [dbP, dbS, dbT] = await Promise.all([
          loadFromDB("clone_plants_v1"),
          loadFromDB("clone_strains_v1"),
          loadFromDB("clone_trays_v1"),
        ]);
        const localP = load("clonelog-v4-plants") || load("clonelog-v3-plants");
        const localS = load("clonelog-v4-strains") || load("clonelog-v3-strains");
        const localT = load("clonelog-v4-trays") || load("clonelog-v3-trays");
        if (dbP) { setPlants(dbP); save("clonelog-v4-plants", dbP); } else if (localP) setPlants(localP);
        if (dbS) { setStrains(dbS); save("clonelog-v4-strains", dbS); } else if (localS) setStrains(localS);
        if (dbT) { setTrays(dbT); save("clonelog-v4-trays", dbT); } else if (localT) setTrays(localT);
        setSyncStatus("synced");
      } catch {
        const localP = load("clonelog-v4-plants") || load("clonelog-v3-plants");
        const localS = load("clonelog-v4-strains") || load("clonelog-v3-strains");
        const localT = load("clonelog-v4-trays") || load("clonelog-v3-trays");
        if (localP) setPlants(localP);
        if (localS) setStrains(localS);
        if (localT) setTrays(localT);
        setSyncStatus("offline");
      }
      setLoading(false);
      saveReadyRef.current = true;
    })();
  }, []);

  // ── Real-time subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    const subs = [
      subscribeToKey("clone_plants_v1", (val, ts) => {
        if (!val) return;
        if (pendingTimestampsRef.current.has(normTs(ts))) return;
        setPlants(val); save("clonelog-v4-plants", val);
      }),
      subscribeToKey("clone_strains_v1", (val, ts) => {
        if (!val) return;
        if (pendingTimestampsRef.current.has(normTs(ts))) return;
        setStrains(val); save("clonelog-v4-strains", val);
      }),
      subscribeToKey("clone_trays_v1", (val, ts) => {
        if (!val) return;
        if (pendingTimestampsRef.current.has(normTs(ts))) return;
        setTrays(val); save("clonelog-v4-trays", val);
      }),
    ];
    return () => subs.forEach(s => s.unsubscribe());
  }, []);

  // ── Save helpers ──────────────────────────────────────────────────────────
  const savePlants = useCallback((u, pushUndo = true) => {
    if (pushUndo) setUndoStack(prev => [...prev.slice(-9), plants]);
    setPlants(u); save("clonelog-v4-plants", u);
    if (!saveReadyRef.current) return;
    const ts = new Date().toISOString();
    pendingTimestampsRef.current.add(ts);
    setSyncStatus("syncing");
    saveToDB("clone_plants_v1", u, ts)
      .then(() => { pendingTimestampsRef.current.delete(ts); setSyncStatus("synced"); })
      .catch(() => { pendingTimestampsRef.current.delete(ts); setSyncStatus("error"); });
  }, [plants]);

  const saveStrains = useCallback(u => {
    setStrains(u); save("clonelog-v4-strains", u);
    if (!saveReadyRef.current) return;
    const ts = new Date().toISOString();
    pendingTimestampsRef.current.add(ts);
    saveToDB("clone_strains_v1", u, ts)
      .then(() => pendingTimestampsRef.current.delete(ts))
      .catch(() => pendingTimestampsRef.current.delete(ts));
  }, []);

  const saveTrays = useCallback(u => {
    setTrays(u); save("clonelog-v4-trays", u);
    if (!saveReadyRef.current) return;
    const ts = new Date().toISOString();
    pendingTimestampsRef.current.add(ts);
    saveToDB("clone_trays_v1", u, ts)
      .then(() => pendingTimestampsRef.current.delete(ts))
      .catch(() => pendingTimestampsRef.current.delete(ts));
  }, []);

  useEffect(() => {
    if (!smartInput.trim()) { setParsed(null); setEntryError(""); return; }
    setParsed(parseSmartEntry(smartInput, strains));
    setEntryError("");
  }, [smartInput, strains]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleUndo() {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    savePlants(prev, false);
    setUndoToast(true);
    setTimeout(() => setUndoToast(false), 2500);
  }

  function handleAddEntry() {
    if (!parsed?.resolved) { setEntryError("Strain code not found. Try: '19 2023b march 24'"); return; }
    if (!parsed.qty) { setEntryError("Add a quantity, e.g. '19 2023b'"); return; }
    setShowConfirm(true);
  }

  function handleConfirmAdd() {
    const { strain, suffix } = parsed.resolved;
    const newPlants = Array.from({ length: parsed.qty }, () => ({
      id: uid(), strainCode: strain.code + (suffix || ""),
      strainName: strain.name + (suffix ? ` ${suffix}` : ""),
      dateCloned: parsed.dateStr || null,
      dateTransplanted: entryStatus === "Transplanted" ? (entryTransplantDate || today()) : null,
      pot: entryPot, round: entryRound, status: entryStatus,
      notes: entryNote, batchNote: entryNote, tray: entryTray, archived: false,
    }));
    savePlants([...plants, ...newPlants]);
    setSmartInput(""); setParsed(null); setEntryNote(""); setEntryTray("");
    setEntryStatus("Cloned"); setEntryTransplantDate("");
    setShowConfirm(false); setTab("Log");
  }

  function updatePlant(id, field, value) {
    savePlants(plants.map(p => p.id === id ? { ...p, [field]: value } : p));
  }
  function deletePlant(id) { savePlants(plants.filter(p => p.id !== id)); setEditPlant(null); }

  function toggleSelect(id) { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); }
  function clearSelect() { setSelected(new Set()); setSelectMode(false); }

  function applyBulk() {
    savePlants(plants.map(p => {
      if (!selected.has(p.id)) return p;
      const u = { ...p, status: bulkStatus };
      if (bulkRound) u.round = bulkRound;
      if (bulkStatus === "Transplanted") u.dateTransplanted = bulkDate;
      return u;
    }));
    setShowBulkModal(false); clearSelect();
  }
  function archiveBulk() {
    savePlants(plants.map(p => selected.has(p.id) ? { ...p, archived: true, round: "Archived" } : p));
    clearSelect();
  }

  function transplantTray(trayCode, date, survived, round) {
    const { nextPlants, nextTrays } = applyTrayTransplant(plants, trays, trayCode, date, survived, round);
    savePlants(nextPlants);
    saveTrays(nextTrays);
  }

  function cloneBatch(strainName, round) {
    const sameName = plants.filter(p => p.strainName === strainName && !p.archived);
    if (!sameName.length) return 0;
    const template = sameName[0];
    const count = plants.filter(p => p.dateCloned === template.dateCloned && p.strainName === strainName && !p.archived).length || 1;
    const newPlants = Array.from({ length: count }, () => ({
      id: uid(), strainCode: template.strainCode, strainName: template.strainName,
      dateCloned: today(), dateTransplanted: null,
      pot: template.pot, round: round || template.round, status: "Cloned",
      notes: "", batchNote: template.dateCloned ? `Cloned from ${fmtDate(template.dateCloned)} batch` : `Repeat batch — ${template.strainName}`,
      tray: "", archived: false,
    }));
    savePlants([...plants, ...newPlants]);
    return count;
  }

  function promoteRound() {
    savePlants(plants.map(p => {
      if (p.archived) return p;
      if (p.round === "Upcoming") return { ...p, archived: true, round: "Archived" };
      if (p.round === "Next") return { ...p, round: "Upcoming" };
      return p;
    }));
    setShowPromoteModal(false);
  }

  function exportCSV() {
    const esc = v => `"${String(v || "").replace(/"/g, '""')}"`;
    const headers = ["Strain", "Code", "Status", "Round", "Pot", "Tray", "Date Cloned", "Date Transplanted", "Batch Note", "Notes", "Archived"];
    const rows = plants.map(p => [
      esc(p.strainName), esc(p.strainCode), esc(p.status), esc(p.round), esc(p.pot),
      esc(p.tray), esc(fmtDate(p.dateCloned)), esc(fmtDate(p.dateTransplanted)),
      esc(p.batchNote), esc(p.notes), esc(p.archived ? "Yes" : "No"),
    ]);
    const csv = [headers.map(h => esc(h)), ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clone-log-${today()}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function handleAddStrain() {
    if (!newCode.trim() || !newName.trim()) { setStrainError("Both fields required."); return; }
    if (strains.find(s => s.code.toLowerCase() === newCode.trim().toLowerCase())) { setStrainError("Code exists."); return; }
    saveStrains([...strains, { code: newCode.trim(), name: newName.trim() }]);
    setNewCode(""); setNewName(""); setStrainError("");
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const { active, archived } = useMemo(() => {
    const active = [], archived = [];
    for (const p of plants) (p.archived ? archived : active).push(p);
    return { active, archived };
  }, [plants]);

  const upcoming = useMemo(() => active.filter(p => p.round === "Upcoming"), [active]);
  const next = useMemo(() => active.filter(p => p.round === "Next"), [active]);

  const alertTrays = useMemo(() => getAlertTrays(trays), [trays]);

  // Only count plants that originated from a tray transplant (p.tray is set).
  // Individually-logged plants don't have meaningful survival data.
  const survivalByStrain = useMemo(() => calcSurvivalByStrain(plants), [plants]);

  const { displayPlants, grouped } = useMemo(
    () => filterAndGroupPlants(plants, { showArchived, filterStrain, filterRound, filterStatus }),
    [plants, showArchived, filterStrain, filterRound, filterStatus]
  );

  const usedNames = useMemo(() => [...new Set(plants.map(p => p.strainName))].sort(), [plants]);
  const strainColorMap = useMemo(() => buildStrainColorMap(usedNames), [usedNames]);
  const allStrainNames = useMemo(() => strains.map(s => s.name).sort(), [strains]);
  const strainDefColorMap = useMemo(() => buildStrainColorMap(allStrainNames), [allStrainNames]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={20} className="text-amber-600 animate-spin" />
    </div>
  );

  const SyncIcon = syncStatus === "syncing" ? Loader2 : syncStatus === "error" ? AlertCircle : syncStatus === "offline" ? WifiOff : Wifi;
  const syncColor = syncStatus === "syncing" ? "text-yellow-400 animate-spin" : syncStatus === "error" ? "text-red-500" : syncStatus === "offline" ? "text-[#6a5a3a]" : "text-amber-600";

  return (
    <div>
      {/* ── Sub-tab navigation ── */}
      <div className="border-b border-[#2a2418]">
        <div className="flex overflow-x-auto">
          {CLONE_SUB_TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); if (t !== "Log") clearSelect(); }}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${tab === t ? "border-amber-500 text-amber-400" : "border-transparent text-[#6a5a3a] active:text-[#c5b08a]"}`}>
              {t}
              {t === "Trays" && alertTrays.length > 0
                ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 ml-1 mb-0.5 align-middle" />
                : null}
            </button>
          ))}
        </div>
        {/* Utility row: sync + export + search */}
        <div className="flex items-center justify-end gap-1 px-3 pb-1">
          <SyncIcon size={11} className={syncColor} />
          <button onClick={exportCSV} aria-label="Export CSV"
            className="text-[#6a5a3a] active:text-[#c5b08a] w-8 h-7 flex items-center justify-center">
            <Download size={12} />
          </button>
          <button onClick={() => setShowSearch(s => !s)} aria-label="Search"
            className={`w-8 h-7 flex items-center justify-center ${showSearch ? "text-amber-400" : "text-[#6a5a3a] active:text-[#c5b08a]"}`}>
            <Search size={12} />
          </button>
        </div>
      </div>

      {/* ── Search bar ── */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-[#2a2418]">
          <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); } }}
            placeholder="Search strain, tray, status, note…"
            className="w-full bg-[#111111] border border-[#2a2418] rounded-xl px-4 py-2.5 text-sm text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none focus:border-amber-500 transition-colors" />
          {searchQuery.trim() && (() => {
            const results = searchPlants(plants, searchQuery);
            const grp = groupByStrain(results);
            return (
              <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
                {results.length === 0
                  ? <div className="text-xs text-[#6a5a3a] text-center py-4">No results</div>
                  : Object.entries(grp).map(([name, group]) => (
                    <div key={name} className="bg-[#111111] border border-[#2a2418] rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-[#1a1a1a]/60 flex justify-between">
                        <span className="text-xs font-semibold text-[#f5f5f0]">{name}</span>
                        <span className="text-xs text-[#6a5a3a]">{group.length}</span>
                      </div>
                      {group.slice(0, 3).map(p => (
                        <div key={p.id} className="px-3 py-2 flex items-center justify-between border-t border-[#2a2418]/50">
                          <div className="flex gap-1.5 flex-wrap">
                            <Badge label={p.status} colorClass={STATUS_COLORS[p.status] || "bg-[#1a1a1a] text-[#c5b08a] border-[#2a2418]"} />
                            <Badge label={p.round} colorClass={ROUND_COLORS[p.round] || "bg-[#1a1a1a] text-[#c5b08a] border-[#2a2418]"} />
                            {p.tray && <Badge label={p.tray} colorClass="bg-[#1a1a1a]/60 text-[#6a5a3a] border border-[#2a2418]/50" />}
                          </div>
                          <button onClick={() => { setEditPlant({ ...p }); setShowSearch(false); }}
                            className="text-[#6a5a3a] hover:text-[#c5b08a] text-xs px-2 py-1 rounded border border-[#2a2418] ml-2">Edit</button>
                        </div>
                      ))}
                      {group.length > 3 && <div className="px-3 py-1.5 text-[10px] text-[#6a5a3a] border-t border-[#2a2418]/40">+{group.length - 3} more</div>}
                    </div>
                  ))
                }
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Log tab toolbar ── */}
      {tab === "Log" && (
        <div className="px-4 pt-2 pb-1 flex items-center justify-between gap-2 border-b border-[#2a2418]/50">
          <div className="text-[10px] text-[#6a5a3a]">{active.length} active · {archived.length} archived</div>
          <div className="flex gap-1.5">
            <button onClick={() => setCompactView(v => !v)}
              className={`text-xs border rounded-lg px-2.5 py-1 transition-colors ${compactView ? "bg-[#2a2418] border-[#2a2418] text-[#f5f5f0]" : "border-[#2a2418] text-[#6a5a3a]"}`}>
              {compactView ? "Full" : "Compact"}
            </button>
            {selectMode
              ? <button onClick={clearSelect} className="text-xs text-red-400 border border-red-900/40 rounded-lg px-2.5 py-1">Cancel</button>
              : <button onClick={() => setSelectMode(true)} className="text-xs text-[#6a5a3a] border border-[#2a2418] rounded-lg px-2.5 py-1">Select</button>
            }
          </div>
        </div>
      )}

      {/* ── Undo toast ── */}
      {undoToast && (
        <button onClick={() => setUndoToast(false)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] border border-[#2a2418] text-[#c5b08a] text-xs px-4 py-2.5 rounded-full shadow-xl">
          ↩ Entry undone — tap to dismiss
        </button>
      )}

      {/* ── SUMMARY ── */}
      {tab === "Summary" && (
        <div className="p-4 space-y-6">
          {alertTrays.length > 0 && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-xl p-4 space-y-2">
              <div className="text-xs text-red-300 font-semibold flex items-center gap-1.5"><AlertCircle size={13} /> Trays Past Day {TRAY_ALERT_DAYS} — Transplant Now</div>
              {alertTrays.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-red-200 font-bold">{t.code}</span>
                    <span className="text-xs text-red-400/70 ml-2">{t.strainName}</span>
                  </div>
                  <span className="text-xs text-red-300 font-bold">Day {daysSince(t.dateStarted)}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider mb-2">All Active</div>
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Cloned / In Tray" value={active.filter(p => p.status === "Cloned").length} colorClass="text-amber-400" />
              <StatBox label="Transplanted" value={active.filter(p => p.status === "Transplanted").length} colorClass="text-sky-400" />
            </div>
          </div>

          {next.length > 0 && upcoming.length > 0 && (
            <button onClick={() => setShowPromoteModal(true)}
              className="w-full bg-teal-900/30 border border-teal-700/40 text-teal-300 text-xs font-medium py-3 rounded-xl active:bg-teal-900/50 transition-colors flex items-center justify-center gap-2">
              🔁 Promote Round — Move Next → Upcoming
            </button>
          )}

          <RoundPanel title="Upcoming Round" plants={upcoming} colorClass={ROUND_COLORS["Upcoming"]} />
          <RoundPanel title="Next Round" plants={next} colorClass={ROUND_COLORS["Next"]} />

          <div>
            <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider mb-2">Transplant Pipeline</div>
            {(() => {
              const rows = buildTransplantPipeline(trays, active);
              if (rows.length === 0) return (
                <div className="bg-[#111111] border border-[#2a2418] rounded-xl p-4 text-xs text-[#6a5a3a] text-center">No active trays or clones in pipeline</div>
              );
              return (
                <div className="bg-[#111111] border border-[#2a2418] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-3 px-4 py-2 bg-[#1a1a1a]/60 text-[10px] text-[#6a5a3a] uppercase tracking-wider">
                    <span>Strain</span><span className="text-center">In Trays</span><span className="text-right">Logged</span>
                  </div>
                  <div className="divide-y divide-[#2a2418]/50">
                    {rows.map(r => (
                      <div key={r.name} className="px-4 py-3 grid grid-cols-3 items-center">
                        <span className="text-xs text-[#c5b08a] truncate pr-2">{r.name}</span>
                        <span className="text-center text-sm font-bold text-amber-400">{r.trayCount || "—"}</span>
                        <div className="text-right">
                          <span className={`text-xs font-medium ${r.loggedCount > 0 ? "text-sky-400" : "text-[#6a5a3a]"}`}>
                            {r.loggedCount > 0 ? `${r.loggedCount} logged` : "none logged"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 bg-[#1a1a1a]/30 flex justify-between text-[10px] text-[#6a5a3a]">
                    <span>In trays: <span className="text-amber-400 font-bold">{rows.reduce((s, r) => s + r.trayCount, 0)}</span></span>
                    <span>Logged: <span className="text-sky-400 font-bold">{rows.reduce((s, r) => s + r.loggedCount, 0)}</span></span>
                  </div>
                </div>
              );
            })()}
          </div>

          {Object.keys(survivalByStrain).length > 0 && (
            <div>
              <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider mb-2">Survival Rates</div>
              <div className="bg-[#111111] border border-[#2a2418] rounded-xl overflow-hidden">
                <div className="grid grid-cols-3 px-4 py-2 bg-[#1a1a1a]/60 text-[10px] text-[#6a5a3a] uppercase tracking-wider">
                  <span>Strain</span><span className="text-center">Rate</span><span className="text-right">Count</span>
                </div>
                <div className="divide-y divide-[#2a2418]/50">
                  {Object.entries(survivalByStrain)
                    .sort((a, b) => (b[1].transplanted / b[1].total) - (a[1].transplanted / a[1].total))
                    .map(([name, data]) => {
                      const rate = data.total > 0 ? Math.round((data.transplanted / data.total) * 100) : 0;
                      const color = rate >= 80 ? "text-emerald-400" : rate >= 60 ? "text-amber-400" : "text-red-400";
                      return (
                        <div key={name} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-[#c5b08a] truncate pr-2 flex-1">{name}</span>
                            <span className={`text-sm font-bold ${color} ml-2`}>{rate}%</span>
                            <span className="text-[10px] text-[#6a5a3a] ml-3">{data.transplanted}/{data.total}</span>
                          </div>
                          <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${rate >= 80 ? "bg-emerald-500" : rate >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${rate}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LOG ── */}
      {tab === "Log" && (
        <div className="p-4 space-y-3">
          {selectMode && selected.size > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-[#c5b08a]">{selected.size} selected</span>
              <div className="flex gap-2">
                <button onClick={() => setShowBulkModal(true)} className="text-xs bg-amber-600 active:bg-amber-700 text-[#f5f5f0] px-3 py-1.5 rounded-lg transition-colors">Update All</button>
                <button onClick={archiveBulk} className="text-xs bg-[#2a2418] active:bg-[#1a1a1a] text-[#f5f5f0] px-3 py-1.5 rounded-lg transition-colors">Archive</button>
              </div>
            </div>
          )}
          {!selectMode && undoStack.length > 0 && (
            <button onClick={handleUndo}
              className="w-full text-xs text-[#6a5a3a] border border-[#2a2418] rounded-xl py-2 active:text-[#c5b08a] transition-colors">
              ↩ Undo last entry
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setShowArchived(false); setFilterRound("All"); setFilterStatus("All"); setFilterStrain("All"); }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${!showArchived ? "bg-[#2a1f00] border-[#3a2e00] text-amber-300" : "bg-[#111111] border-[#2a2418] text-[#6a5a3a]"}`}>Active</button>
            <button onClick={() => { setShowArchived(true); setFilterRound("All"); setFilterStatus("All"); setFilterStrain("All"); }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showArchived ? "bg-[#2a2418] border-[#2a2418] text-[#f5f5f0]" : "bg-[#111111] border-[#2a2418] text-[#6a5a3a]"}`}>
              Archived {archived.length > 0 && `(${archived.length})`}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={filterStrain} onChange={e => setFilterStrain(e.target.value)}
              className="bg-[#111111] border border-[#2a2418] text-[#c5b08a] text-xs rounded-lg px-2 py-1.5 flex-1 min-w-0">
              <option value="All">All Strains</option>
              {usedNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={filterRound} onChange={e => setFilterRound(e.target.value)}
              className="bg-[#111111] border border-[#2a2418] text-[#c5b08a] text-xs rounded-lg px-2 py-1.5">
              <option value="All">All Rounds</option>
              <option>Upcoming</option><option>Next</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-[#111111] border border-[#2a2418] text-[#c5b08a] text-xs rounded-lg px-2 py-1.5">
              <option value="All">All Status</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-16 text-[#6a5a3a] text-sm">
              <div className="text-4xl mb-3">{showArchived ? "📦" : "🌱"}</div>
              {showArchived ? "No archived plants." : "No plants yet."}
            </div>
          )}
          {Object.entries(grouped).map(([strainName, group]) => {
            const groupIds = group.map(p => p.id);
            const allSel = groupIds.every(id => selected.has(id));
            const survData = survivalByStrain[strainName];
            const rate = survData && survData.total > 0 ? Math.round((survData.transplanted / survData.total) * 100) : null;
            const dotColor = strainColorMap[strainName] || STRAIN_PALETTE[0];
            const isCollapsed = collapsedLogStrains.has(strainName);
            return (
              <div key={strainName} className="bg-[#111111] border border-[#2a2418] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#1a1a1a]/60 flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectMode && (
                      <input type="checkbox" checked={allSel}
                        onChange={() => allSel
                          ? setSelected(s => { const n = new Set(s); groupIds.forEach(id => n.delete(id)); return n; })
                          : setSelected(s => new Set([...s, ...groupIds]))}
                        className="w-4 h-4 accent-amber-500 flex-shrink-0" />
                    )}
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                    <button onClick={() => toggleLogStrain(strainName)}
                      className="text-sm font-semibold text-[#f5f5f0] truncate text-left">
                      {strainName}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {rate !== null && <span className={`text-[10px] font-bold ${rate >= 80 ? "text-emerald-500" : rate >= 60 ? "text-amber-500" : "text-red-500"}`}>{rate}%</span>}
                    <span className="text-xs text-[#6a5a3a]">{group.length}</span>
                    <button onClick={() => toggleLogStrain(strainName)}
                      className={`text-[#6a5a3a] transition-transform duration-150 text-xs ${isCollapsed ? "" : "rotate-180"}`}>▾</button>
                  </div>
                </div>
                {!isCollapsed && !compactView && group[0]?.batchNote && (
                  <div className="px-4 py-2 bg-[#1a1a1a]/20 text-xs text-[#6a5a3a] italic border-b border-[#2a2418]/40">📝 {group[0].batchNote}</div>
                )}
                {!isCollapsed && compactView ? (
                  <div className="divide-y divide-[#2a2418]/30">
                    {group.map(p => (
                      <div key={p.id} onClick={selectMode ? () => toggleSelect(p.id) : undefined}
                        className={`px-4 py-2 flex items-center gap-2 ${selectMode ? "cursor-pointer" : ""} ${selected.has(p.id) ? "bg-amber-900/10" : ""}`}>
                        {selectMode && <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="w-4 h-4 accent-amber-500 flex-shrink-0" />}
                        <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                        <div className="flex-1 flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLORS[p.status] || "bg-[#1a1a1a] text-[#c5b08a] border-[#2a2418]"}`}>{p.status}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${ROUND_COLORS[p.round] || "bg-[#1a1a1a] text-[#c5b08a] border-[#2a2418]"}`}>{p.round}</span>
                          <span className="text-[10px] text-[#6a5a3a]">{p.pot === "Black Pot" ? "⬛" : "🟩"}</span>
                          {p.tray && <span className="text-[10px] text-[#6a5a3a]">{p.tray}</span>}
                          {p.dateCloned && <span className="text-[10px] text-[#6a5a3a]">{fmtDate(p.dateCloned)}</span>}
                          {p.dateTransplanted && <span className="text-[10px] text-sky-700">{fmtDate(p.dateTransplanted)}</span>}
                        </div>
                        {!selectMode && <button onClick={() => setEditPlant({ ...p })} className="text-[#6a5a3a] active:text-[#c5b08a] text-[10px] flex-shrink-0">✎</button>}
                      </div>
                    ))}
                  </div>
                ) : !isCollapsed ? (
                  <div className="divide-y divide-[#2a2418]/40">
                    {group.map(p => (
                      <div key={p.id} onClick={selectMode ? () => toggleSelect(p.id) : undefined}
                        className={`px-4 py-3 flex items-start gap-3 ${selectMode ? "cursor-pointer" : ""} ${selected.has(p.id) ? "bg-amber-900/10" : ""}`}>
                        {selectMode && <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="w-4 h-4 mt-0.5 accent-amber-500 flex-shrink-0" />}
                        <div className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: dotColor, opacity: 0.5 }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1.5 mb-1.5">
                            <Badge label={p.status} colorClass={STATUS_COLORS[p.status] || "bg-[#1a1a1a] text-[#c5b08a] border-[#2a2418]"} />
                            <Badge label={p.round} colorClass={ROUND_COLORS[p.round] || "bg-[#1a1a1a] text-[#c5b08a] border-[#2a2418]"} />
                            <Badge label={p.pot} colorClass="bg-[#1a1a1a] text-[#c5b08a] border border-[#2a2418]" />
                            {p.tray && <Badge label={p.tray} colorClass="bg-[#1a1a1a]/60 text-[#6a5a3a] border border-[#2a2418]/50" />}
                          </div>
                          <div className="text-xs text-[#6a5a3a] space-y-0.5">
                            {p.dateCloned && <div>Cloned: <span className="text-[#c5b08a]">{fmtDate(p.dateCloned)}</span></div>}
                            {p.dateTransplanted && <div>Transplanted: <span className="text-[#c5b08a]">{fmtDate(p.dateTransplanted)}</span></div>}
                            {p.notes && <div className="text-[#6a5a3a] italic truncate">{p.notes}</div>}
                          </div>
                        </div>
                        {!selectMode && (
                          <button onClick={() => setEditPlant({ ...p })}
                            className="text-[#6a5a3a] active:text-[#c5b08a] text-xs px-2 py-1 rounded border border-[#2a2418] transition-colors flex-shrink-0">Edit</button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADD ENTRY ── */}
      {tab === "Add Entry" && (
        <div className="p-4 space-y-5">
          <div>
            <div className="text-xs text-[#6a5a3a] mb-1.5">Quick entry</div>
            <input value={smartInput} onChange={e => setSmartInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddEntry()}
              placeholder="e.g. 19 2023b march 24"
              className="w-full bg-[#111111] border border-[#2a2418] rounded-xl px-4 py-3 text-sm text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none focus:border-amber-500 transition-colors" />
            {entryError && <div className="text-red-400 text-xs mt-1.5">{entryError}</div>}
          </div>
          {parsed && (
            <div className={`rounded-xl border p-4 space-y-2 text-xs ${parsed.resolved && parsed.qty ? "border-[#3a2e00] bg-amber-900/10" : "border-[#2a2418] bg-[#111111]"}`}>
              <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider mb-1">Preview</div>
              {[
                ["Strain", parsed.resolved ? `${parsed.resolved.strain.name}${parsed.resolved.suffix ? " " + parsed.resolved.suffix : ""}` : "Not recognized", !!parsed.resolved],
                ["Quantity", parsed.qty ?? "Not found", !!parsed.qty],
                ...(parsed.dateStr ? [["Clone Date", fmtDate(parsed.dateStr), true]] : []),
              ].map(([l, v, ok]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-[#6a5a3a]">{l}</span>
                  <span className={ok ? "text-emerald-300" : "text-red-400"}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <div className="text-xs text-[#6a5a3a] mb-1.5">Pot Type</div>
            <div className="flex gap-2">
              {["Black Pot", "Green Pot"].map(p => (
                <button key={p} onClick={() => setEntryPot(p)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${entryPot === p ? "bg-[#2a1f00] border-amber-600 text-amber-300" : "bg-[#111111] border-[#2a2418] text-[#c5b08a]"}`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#6a5a3a] mb-1.5">Round</div>
            <div className="flex gap-2">
              {["Upcoming", "Next"].map(r => (
                <button key={r} onClick={() => setEntryRound(r)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${entryRound === r ? "bg-teal-900/40 border-teal-600 text-teal-300" : "bg-[#111111] border-[#2a2418] text-[#c5b08a]"}`}>{r}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#6a5a3a] mb-1.5">Status</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setEntryStatus("Cloned")}
                className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${entryStatus === "Cloned" ? "border-emerald-600 bg-emerald-900/40 text-emerald-300" : "bg-[#111111] border-[#2a2418] text-[#c5b08a]"}`}>
                🌱 In Tray
              </button>
              <button onClick={() => setEntryStatus("Transplanted")}
                className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${entryStatus === "Transplanted" ? "border-sky-600 bg-sky-900/40 text-sky-300" : "bg-[#111111] border-[#2a2418] text-[#c5b08a]"}`}>
                🪴 Transplanted
              </button>
            </div>
          </div>
          {entryStatus === "Transplanted" && (
            <div>
              <div className="text-xs text-[#6a5a3a] mb-1.5">Date Transplanted</div>
              <input type="date" value={entryTransplantDate} onChange={e => setEntryTransplantDate(e.target.value)}
                className="w-full bg-[#111111] border border-[#2a2418] rounded-xl px-4 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-sky-600 transition-colors" />
            </div>
          )}
          <div>
            <div className="text-xs text-[#6a5a3a] mb-1.5">Batch Note <span className="text-[#6a5a3a]">(optional)</span></div>
            <input value={entryNote} onChange={e => setEntryNote(e.target.value)} placeholder="e.g. strong roots, top shelf tray"
              className="w-full bg-[#111111] border border-[#2a2418] rounded-xl px-4 py-2.5 text-sm text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none transition-colors" />
          </div>
          <div>
            <div className="text-xs text-[#6a5a3a] mb-1.5">Tray Code <span className="text-[#6a5a3a]">(optional)</span></div>
            <div className="flex gap-2">
              <input value={entryTray} onChange={e => setEntryTray(e.target.value.toUpperCase())} placeholder="e.g. 2023-T1"
                className="flex-1 bg-[#111111] border border-[#2a2418] rounded-xl px-4 py-2.5 text-sm text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none transition-colors" />
              {parsed?.resolved && (
                <button onClick={() => setEntryTray(parsed.resolved.strain.code + "-T1")}
                  className="text-xs bg-[#1a1a1a] border border-[#2a2418] text-[#c5b08a] px-3 rounded-xl active:text-[#f5f5f0] transition-colors">Auto</button>
              )}
            </div>
            {trays.filter(t => t.status === "Active").length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trays.filter(t => t.status === "Active").map(t => (
                  <button key={t.id} onClick={() => setEntryTray(t.code)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${entryTray === t.code ? "bg-[#2a1f00] border-amber-600 text-amber-300" : "bg-[#111111] border-[#2a2418] text-[#6a5a3a]"}`}>
                    {t.code}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleAddEntry}
            className="w-full bg-amber-600 active:bg-amber-700 text-[#f5f5f0] font-semibold py-3 rounded-xl text-sm transition-colors">
            Review & Confirm →
          </button>

          {usedNames.length > 0 && (
            <div className="bg-[#111111] border border-[#2a2418] rounded-xl p-4">
              <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider mb-3">⚡ Clone a Previous Batch</div>
              <CloneBatchShortcut strains={usedNames} plants={plants} onClone={(strainName, round) => {
                const cnt = cloneBatch(strainName, round);
                if (cnt) setTab("Log");
              }} />
            </div>
          )}

          <ImportFromMotherLog strains={strains} plants={plants} savePlants={savePlants} onAdded={() => setTab("Log")} />

          <div className="bg-[#111111] border border-[#2a2418] rounded-xl p-4">
            <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider mb-3">Or Add Manually</div>
            <ManualEntry strains={strains} plants={plants} savePlants={savePlants} onAdded={() => setTab("Log")} />
          </div>
        </div>
      )}

      {/* ── TRAYS ── */}
      {tab === "Trays" && (
        <TrayManager trays={trays} saveTrays={saveTrays} strains={strains} plants={plants}
          onTransplantTray={transplantTray} alertTrays={alertTrays} />
      )}

      {/* ── STRAINS ── */}
      {tab === "Strains" && (
        <div className="p-4 space-y-4">
          <div className="bg-[#111111] border border-[#2a2418] rounded-xl p-4 space-y-3">
            <div className="text-xs text-[#6a5a3a] font-medium">Add Strain Code</div>
            <div className="flex gap-2">
              <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Code"
                className="w-20 bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-xs text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none focus:border-amber-500" />
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Strain name"
                className="flex-1 bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-xs text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none focus:border-amber-500" />
              <button onClick={handleAddStrain} className="bg-amber-600 active:bg-amber-700 text-[#f5f5f0] text-xs px-3 rounded-lg transition-colors">Add</button>
            </div>
            {strainError && <div className="text-red-400 text-xs">{strainError}</div>}
          </div>
          <div className="bg-[#111111] border border-[#2a2418] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[#1a1a1a]/60 text-[10px] text-[#6a5a3a] uppercase tracking-wider grid grid-cols-3">
              <span>Code</span><span>Name</span><span />
            </div>
            <div className="divide-y divide-[#2a2418]/60">
              {strains.map(s => {
                const dotC = strainDefColorMap[s.name] || STRAIN_PALETTE[0];
                return (
                  <div key={s.code} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotC }} />
                    <span className="font-bold text-xs w-12 flex-shrink-0" style={{ color: dotC }}>{s.code}</span>
                    <span className="text-[#f5f5f0] text-xs flex-1">{s.name}</span>
                    {TESTER_CODES.includes(s.code) && <span className="text-[10px] text-amber-600 border border-amber-900/40 rounded px-1.5 py-0.5 flex-shrink-0">tester</span>}
                    <button onClick={() => { if (window.confirm("Remove?")) saveStrains(strains.filter(x => x.code !== s.code)); }}
                      className="text-[#6a5a3a] active:text-red-400 transition-colors text-xs flex-shrink-0">✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM MODAL ── */}
      {showConfirm && parsed?.resolved && (
        <Modal title="Confirm Entry" onClose={() => setShowConfirm(false)}>
          <div className="space-y-4">
            <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-2.5">
              {[
                ["Strain", `${parsed.resolved.strain.name}${parsed.resolved.suffix ? " " + parsed.resolved.suffix : ""}`, true],
                ["Quantity", `${parsed.qty} plants`, true],
                ["Date Cloned", fmtDate(parsed.dateStr), false],
                ["Pot", entryPot, false],
                ["Round", entryRound, false],
                ...(entryNote ? [["Batch Note", entryNote, false]] : []),
                ...(entryTray ? [["Tray", entryTray, false]] : []),
                ...(entryStatus === "Transplanted" ? [["Status", "Transplanted", false]] : []),
                ...(entryStatus === "Transplanted" && entryTransplantDate ? [["Transplant Date", fmtDate(entryTransplantDate), false]] : []),
              ].map(([l, v, h]) => (
                <div key={l} className="flex justify-between items-center">
                  <span className="text-xs text-[#6a5a3a]">{l}</span>
                  <span className={`text-xs font-medium ${h ? "text-amber-300" : "text-[#f5f5f0]"}`}>{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#6a5a3a] text-center">Adds {parsed.qty} individual records to the log.</p>
            <button onClick={handleConfirmAdd}
              className="w-full bg-amber-600 active:bg-amber-700 text-[#f5f5f0] font-semibold py-3 rounded-xl text-sm transition-colors">✓ Confirm & Add</button>
            <button onClick={() => setShowConfirm(false)} className="w-full text-[#6a5a3a] text-xs py-2">← Edit Entry</button>
          </div>
        </Modal>
      )}

      {/* ── BULK MODAL ── */}
      {showBulkModal && (
        <Modal title={`Update ${selected.size} Plants`} onClose={() => setShowBulkModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#6a5a3a] block mb-1.5">New Status</label>
              <div className="grid grid-cols-2 gap-2">
                {["Cloned", "Transplanted"].map(s => (
                  <button key={s} onClick={() => setBulkStatus(s)}
                    className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${bulkStatus === s ? "border-amber-600 bg-[#2a1f00] text-amber-300" : "border-[#2a2418] bg-[#1a1a1a] text-[#c5b08a]"}`}>{s}</button>
                ))}
              </div>
            </div>
            {bulkStatus === "Transplanted" && (
              <div>
                <label className="text-xs text-[#6a5a3a] block mb-1.5">Transplant Date</label>
                <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-sm text-[#f5f5f0] focus:outline-none" />
              </div>
            )}
            <div>
              <label className="text-xs text-[#6a5a3a] block mb-1.5">Change Round <span className="text-[#6a5a3a]">(optional)</span></label>
              <div className="flex gap-2">
                {[["", "No change"], ["Upcoming", "Upcoming"], ["Next", "Next"]].map(([v, l]) => (
                  <button key={v} onClick={() => setBulkRound(v)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${bulkRound === v ? "border-teal-600 bg-teal-900/40 text-teal-300" : "border-[#2a2418] bg-[#1a1a1a] text-[#c5b08a]"}`}>{l}</button>
                ))}
              </div>
            </div>
            <button onClick={applyBulk}
              className="w-full bg-amber-600 active:bg-amber-700 text-[#f5f5f0] font-semibold py-3 rounded-xl text-sm transition-colors">Apply to {selected.size} Plants</button>
          </div>
        </Modal>
      )}

      {/* ── EDIT MODAL ── */}
      {editPlant && (
        <Modal title={editPlant.strainName} onClose={() => setEditPlant(null)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#6a5a3a] block mb-1.5">Status</label>
              <div className="grid grid-cols-2 gap-2">
                {["Cloned", "Transplanted"].map(s => (
                  <button key={s} onClick={() => { const u = { ...editPlant, status: s }; setEditPlant(u); updatePlant(editPlant.id, "status", s); }}
                    className={`py-2 rounded-lg text-xs font-medium border transition-colors ${editPlant.status === s ? "border-amber-600 bg-[#2a1f00] text-amber-300" : "border-[#2a2418] bg-[#1a1a1a] text-[#c5b08a]"}`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#6a5a3a] block mb-1.5">Round</label>
              <div className="flex gap-2">
                {["Upcoming", "Next"].map(r => (
                  <button key={r} onClick={() => { const u = { ...editPlant, round: r }; setEditPlant(u); updatePlant(editPlant.id, "round", r); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${editPlant.round === r ? "bg-teal-900/40 border-teal-600 text-teal-300" : "bg-[#1a1a1a] border-[#2a2418] text-[#c5b08a]"}`}>{r}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#6a5a3a] block mb-1.5">Pot Type</label>
              <div className="flex gap-2">
                {["Black Pot", "Green Pot"].map(pt => (
                  <button key={pt} onClick={() => { const u = { ...editPlant, pot: pt }; setEditPlant(u); updatePlant(editPlant.id, "pot", pt); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${editPlant.pot === pt ? "bg-[#2a1f00] border-amber-600 text-amber-300" : "bg-[#1a1a1a] border-[#2a2418] text-[#c5b08a]"}`}>{pt}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#6a5a3a] block mb-1.5">Transplant Date</label>
              <input type="date" value={editPlant.dateTransplanted || ""}
                onChange={e => { const u = { ...editPlant, dateTransplanted: e.target.value }; setEditPlant(u); updatePlant(editPlant.id, "dateTransplanted", e.target.value); }}
                className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-sm text-[#f5f5f0] focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-[#6a5a3a] block mb-1.5">Notes</label>
              <textarea value={editPlant.notes || ""} rows={2}
                onChange={e => { const u = { ...editPlant, notes: e.target.value }; setEditPlant(u); updatePlant(editPlant.id, "notes", e.target.value); }}
                className="w-full bg-[#1a1a1a] border border-[#2a2418] rounded-lg px-3 py-2 text-sm text-[#f5f5f0] focus:outline-none resize-none" />
            </div>
            <button onClick={() => deletePlant(editPlant.id)}
              className="w-full py-2 text-xs text-red-400 border border-red-900/40 rounded-lg active:bg-red-900/20 transition-colors">Remove Plant</button>
          </div>
        </Modal>
      )}

      {/* ── ROUND PROMOTE MODAL ── */}
      {showPromoteModal && (
        <Modal title="Promote Round" onClose={() => setShowPromoteModal(false)}>
          <div className="space-y-4">
            <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[#6a5a3a]">Upcoming plants</span><span className="text-[#f5f5f0]">{upcoming.length} → archived</span></div>
              <div className="flex justify-between"><span className="text-[#6a5a3a]">Next plants</span><span className="text-teal-300">{next.length} → Upcoming</span></div>
            </div>
            <p className="text-xs text-[#6a5a3a] text-center">Current Upcoming round will be archived. Next round becomes the new Upcoming.</p>
            <button onClick={promoteRound}
              className="w-full bg-teal-700 active:bg-teal-800 text-[#f5f5f0] font-semibold py-3 rounded-xl text-sm transition-colors">🔁 Confirm Promotion</button>
            <button onClick={() => setShowPromoteModal(false)} className="w-full text-[#6a5a3a] text-xs py-2">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
