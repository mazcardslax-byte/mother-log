import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { loadFromDB, saveToDB, subscribeToKey } from "./supabase";
import {
  LayoutDashboard, Leaf, Grid3X3, Plus, Download,
  Wifi, Loader2, AlertCircle,
  ChevronDown, Droplets, ClipboardList,
  Scissors, FlaskConical, ChevronRight,
} from "lucide-react";

// ── Image Compression ───────────────────────────────────────────────────────
function compressImage(file, maxPx = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Storage ────────────────────────────────────────────────────────────────
function load(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// ── Strains ────────────────────────────────────────────────────────────────
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

const CONTAINERS = [
  "Black Pot",
  "Green Pot",
  "3 Gallon",
  "5 Gallon Bucket",
  "7 Gallon",
  "12 Gallon",
];

const MOTHER_STATUSES = ["Active", "Sidelined"];

const COMMON_AMENDMENTS = [
  "Fish emulsion", "Recharge", "Top dress compost", "Cal-mag",
  "Kelp meal", "Worm castings", "Neem meal", "Mycorrhizae",
  "Epsom salt", "Unsulfured molasses", "Silica", "pH down", "pH up",
];

const FEEDING_TYPES = [
  "Water Only",
  "Light Feed",
  "Full Feed",
  "Flush",
  "Foliar Spray",
  "Compost Tea",
];

// Tab bar items — static, hoisted to module scope to avoid per-render allocation
const TAB_ITEMS = [
  { key: "Summary",  label: "Summary",  icon: LayoutDashboard },
  { key: "Mothers",  label: "Mothers",  icon: Leaf },
  { key: "Room",     label: "Room",     icon: Grid3X3 },
  { key: "Facility", label: "Facility", icon: ClipboardList },
];

const DETAIL_TABS = ["Overview", "History", "Photos"];

const TYPE_META = {
  transplant: { label: "Transplant", text: "text-sky-400",    border: "border-sky-700" },
  amendment:  { label: "Amendment",  text: "text-violet-400", border: "border-violet-700" },
  feeding:    { label: "Feeding",     text: "text-emerald-400", border: "border-emerald-700" },
  clone:      { label: "Clone",       text: "text-stone-300",  border: "border-stone-600" },
  reduction:  { label: "Reduction",  text: "text-red-400",    border: "border-red-700" },
};

// ── Facility Data ───────────────────────────────────────────────────────────
const DEFAULT_FACILITY = {
  room2floor:  { label: "Room 2 Floor",      log: [] },
  bench1:      { label: "Bench 1",           log: [] },
  bench2:      { label: "Bench 2",           log: [] },
  bench3:      { label: "Bench 3",           log: [] },
  bench4:      { label: "Bench 4",           log: [] },
  ac_cleaned:  { label: "A/C Cleaned",       log: [] },
  ac_filters:  { label: "Filters Replaced",  log: [] },
};

const FACILITY_SECTIONS = [
  { label: "Floor",   items: ["room2floor"] },
  { label: "Benches", items: ["bench1", "bench2", "bench3", "bench4"] },
  { label: "A/C",     items: ["ac_cleaned", "ac_filters"] },
];

// ── Utilities ──────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}/${y}`;
}
function daysSince(dateStr) {
  if (!dateStr) return null;
  // Parse as local time by replacing dashes to avoid UTC midnight interpretation
  const [y, m, d] = dateStr.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  const diff = Date.now() - local.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}
function getStrain(code) {
  return STRAINS.find(s => s.code === code) || { code, name: "Unknown" };
}

// Normalize Supabase timestamp strings before echo-filter comparison.
// Supabase may return "2024-03-26 10:30:00+00" while we store "2024-03-26T10:30:00.000Z".
function normTs(ts) { try { return ts ? new Date(ts).toISOString() : null; } catch { return ts; } }

function currentContainer(mother) {
  if (!mother.transplantHistory.length) return null;
  return mother.transplantHistory[mother.transplantHistory.length - 1].container;
}
function currentTransplantDate(mother) {
  if (!mother.transplantHistory.length) return null;
  return mother.transplantHistory[mother.transplantHistory.length - 1].date;
}

// ── Threshold color helper ─────────────────────────────────────────────────
// thresholds: [{ max, cls }, ...] sorted ascending by max. Returns cls for
// first entry where value <= max, or last entry's cls as the fallback.
function thresholdColor(value, thresholds) {
  return (thresholds.find(t => value <= t.max) ?? thresholds.at(-1)).cls;
}

// ── Health helpers ─────────────────────────────────────────────────────────
const HEALTH_COLOR_THRESHOLDS = [
  { max: 2, cls: "text-red-400" },
  { max: 3, cls: "text-yellow-400" },
  { max: 5, cls: "text-emerald-400" },
];
const HEALTH_BG_THRESHOLDS = [
  { max: 2, cls: "bg-red-900/40 border-red-700/40 text-red-300" },
  { max: 3, cls: "bg-yellow-900/40 border-yellow-700/40 text-yellow-300" },
  { max: 5, cls: "bg-emerald-900/40 border-emerald-700/40 text-emerald-300" },
];
function healthColor(level) { return thresholdColor(level, HEALTH_COLOR_THRESHOLDS); }
function healthBg(level) { return thresholdColor(level, HEALTH_BG_THRESHOLDS); }
function healthLabel(level) {
  return ["", "Poor", "Fair", "Moderate", "Good", "Excellent"][level] || "—";
}

// ── Feeding helpers ────────────────────────────────────────────────────────
function lastFeedingDate(feedingLog) {
  if (!feedingLog || feedingLog.length === 0) return null;
  return feedingLog.reduce((latest, f) => {
    return !latest || f.date > latest ? f.date : latest;
  }, null);
}

const FEEDING_DAYS_THRESHOLDS = [
  { max: 2, cls: "text-emerald-400" },
  { max: 4, cls: "text-yellow-400" },
  { max: Infinity, cls: "text-red-400" },
];
function feedingDaysColor(days) {
  if (days === null) return "text-zinc-500";
  return thresholdColor(days, FEEDING_DAYS_THRESHOLDS);
}

function daysInVeg(mother) {
  const dates = [
    ...(mother.cloneLog || []).map(c => c.date),
    ...(mother.reductionLog || []).map(r => r.date),
  ].filter(Boolean);
  const latest = dates.length ? dates.sort().at(-1) : null;
  return daysSince(latest ?? mother.createdAt);
}

const VEG_DAYS_THRESHOLDS = [
  { max: 24, cls: "text-zinc-500" },
  { max: 29, cls: "text-yellow-400" },
  { max: Infinity, cls: "text-red-400" },
];
function vegDaysColor(days) {
  if (days === null) return "text-zinc-500";
  return thresholdColor(days, VEG_DAYS_THRESHOLDS);
}

function statusBadgeColor(status) {
  if (status === "Active") return "bg-emerald-900/50 text-emerald-300 border-emerald-700/40";
  if (status === "Sidelined") return "bg-zinc-800 text-zinc-500 border-zinc-700";
  return "bg-zinc-800 text-zinc-500 border-zinc-700";
}

function cardAccentColor(m) {
  if (m.status === "Sidelined") return "border-l-zinc-700";
  if (m.healthLevel <= 2) return "border-l-red-500";
  if (m.healthLevel === 3) return "border-l-yellow-500";
  return "border-l-emerald-500";
}

// ── Shared UI ──────────────────────────────────────────────────────────────
function Badge({ label, colorClass }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#0e1512] border border-zinc-700/50 rounded-t-3xl w-full max-w-md shadow-2xl max-h-[92vh] flex flex-col">
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-zinc-700 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80 flex-shrink-0">
          <span className="text-white font-semibold text-sm">{title}</span>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-xl text-zinc-500 active:text-white active:bg-zinc-800 transition-colors">✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value, colorClass, sub }) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-3.5 text-center">
      <div className={`text-2xl font-bold tracking-tight ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-zinc-500 mt-1 leading-tight font-medium uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-2 px-0.5">{children}</div>;
}

function FormField({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-zinc-400 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500";
const selectCls = "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500";
const btnPrimary = "w-full bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-semibold text-sm rounded-xl py-3 transition-colors";
const btnSecondary = "w-full bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-300 font-medium text-sm rounded-xl py-2.5 transition-colors border border-zinc-700";

function HealthDots({ level }) {
  return (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i <= level
              ? level <= 2 ? "bg-red-400" : level === 3 ? "bg-yellow-400" : "bg-emerald-400"
              : "bg-zinc-700"
          }`}
        />
      ))}
    </div>
  );
}

function ContainerBadge({ container }) {
  const idx = CONTAINERS.indexOf(container);
  const pct = idx < 0 ? 0 : Math.round(((idx + 1) / CONTAINERS.length) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-sky-300 font-medium">{container || "—"}</span>
      <div className="flex-1 h-1 bg-zinc-800 rounded-full min-w-[40px]">
        <div className="h-1 bg-sky-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function defaultMother() {
  return {
    id: uid(),
    strainCode: "",
    status: "Active",
    location: "",
    healthLevel: 4,
    notes: "",
    transplantHistory: [],
    amendmentLog: [],
    cloneLog: [],
    feedingLog: [],
    reductionLog: [],
    photos: [],
    createdAt: today(),
  };
}

// ── QR Label ───────────────────────────────────────────────────────────────
async function printMotherLabel(mother, container, healthLvl) {
  // Open window synchronously (before any await) to avoid mobile popup blockers
  const win = window.open("", "_blank");
  if (!win) return;
  const s = getStrain(mother.strainCode);
  const payload = JSON.stringify({
    id: mother.id,
    strainCode: s.code,
    strainName: s.name,
    status: mother.status,
    location: mother.location || "",
  });
  const QRCode = (await import("qrcode")).default;
  const dataUrl = await QRCode.toDataURL(payload, { width: 150, margin: 1 });
  const printed = new Date().toLocaleDateString("en-US");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Label – ${s.code}</title>
<style>
  @page { size: 2in 3in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 2in; height: 3in; font-family: Arial, sans-serif; background: #fff; color: #000;
         display: flex; flex-direction: column; align-items: center; justify-content: center;
         padding: 10px; text-align: center; }
  img { display: block; width: 110px; height: 110px; margin: 0 auto 6px; }
  .code { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
  .name { font-size: 9px; color: #333; margin-top: 2px; margin-bottom: 6px; }
  .divider { width: 100%; border-top: 1px solid #ccc; margin: 5px 0; }
  .row { font-size: 9px; display: flex; justify-content: space-between; width: 100%; padding: 1px 0; }
  .label { color: #666; }
  .value { font-weight: 700; }
  .printed { font-size: 8px; color: #999; margin-top: 6px; }
</style></head>
<body>
  <img src="${dataUrl}" alt="QR" />
  <div class="code">${s.code}</div>
  <div class="name">${s.name}</div>
  <div class="divider"></div>
  <div class="row"><span class="label">Container</span><span class="value">${container || "—"}</span></div>
  <div class="row"><span class="label">Health</span><span class="value">${healthLabel(healthLvl)} (${healthLvl}/5)</span></div>
  <div class="row"><span class="label">Status</span><span class="value">${mother.status}</span></div>
  ${mother.location ? `<div class="row"><span class="label">Location</span><span class="value">${mother.location}</span></div>` : ""}
  <div class="printed">Printed ${printed}</div>
</body></html>`;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ── CSV Export ──────────────────────────────────────────────────────────────
function exportMotherCSV(mothers) {
  const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const headers = [
    "Strain Code", "Strain Name", "Status", "Health Level", "Health Label",
    "Location", "Current Container", "Days in Current Container",
    "Total Clones Taken", "Total Amendments",
    "Last Amendment Date", "Last Feeding Date", "Notes", "Created Date",
  ];
  const rows = mothers.map(m => {
    const s = getStrain(m.strainCode);
    const transplantHistory = m.transplantHistory || [];
    const amendmentLog = m.amendmentLog || [];
    const cloneLog = m.cloneLog || [];
    const lastTx = transplantHistory.length ? transplantHistory[transplantHistory.length - 1] : null;
    const container = lastTx ? lastTx.container : "";
    const daysInContainer = lastTx ? daysSince(lastTx.date) : "";
    const totalClones = cloneLog.reduce((a, c) => a + (parseInt(c.count) || 0), 0);
    const lastAmend = amendmentLog.length ? [...amendmentLog].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0].date : "";
    const lastFeed = lastFeedingDate(m.feedingLog || []);
    return [
      esc(s.code), esc(s.name), esc(m.status),
      esc(m.healthLevel), esc(healthLabel(m.healthLevel)),
      esc(m.location), esc(container), esc(daysInContainer),
      esc(totalClones), esc(m.amendmentLog.length),
      esc(fmtDate(lastAmend)), esc(fmtDate(lastFeed)),
      esc(m.notes), esc(fmtDate(m.createdAt)),
    ];
  });
  const csv = [headers.map(h => esc(h)), ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mother-log-${today()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function MotherPlantTracker() {
  const [tab, setTab] = useState("Summary");
  const [mothers, setMothers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("live"); // "live" | "syncing" | "error"
  // Set of timestamps for all in-flight saves. Real-time echoes whose
  // updated_at is in this set are our own and should be ignored.
  // Using a Set (vs a single "last" timestamp) prevents rapid successive saves
  // from letting older echoes slip through and overwrite newer state.
  const pendingTimestampsRef = useRef(new Set());
  // Tracks whether init() has completed so the mothers save effect skips the
  // first fire (which would re-save data we just loaded from the DB).
  const saveReadyRef = useRef(false);
  const [roomSpots, setRoomSpots] = useState(new Set());
  const [facility, setFacility] = useState(DEFAULT_FACILITY);
  const facilityPendingRef = useRef(new Set());

  const [detailMotherId, setDetailMotherId] = useState(null);
  const [detailTab, setDetailTab] = useState("Overview");
  const [addForm, setAddForm] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        let stored = await loadFromDB("mothers_v1");

        // One-time migration: if Supabase is empty but localStorage has data, push it up
        if (!stored) {
          try {
            const local = localStorage.getItem("mothers_v1");
            if (local) {
              stored = JSON.parse(local);
              await saveToDB("mothers_v1", stored);
            }
          } catch {}
        }

        if (stored) {
          setMothers(stored.map(m => ({ transplantHistory: [], amendmentLog: [], cloneLog: [], feedingLog: [], reductionLog: [], photos: [], createdAt: today(), ...m })));
        }

        let spots = await loadFromDB("room_v1");
        if (!spots) {
          try {
            const local = localStorage.getItem("room_v1");
            if (local) {
              spots = JSON.parse(local);
              await saveToDB("room_v1", spots);
            }
          } catch {}
        }
        if (spots) setRoomSpots(new Set(spots));

        const fac = await loadFromDB("facility_v1");
        if (fac) setFacility(prev => ({ ...prev, ...fac }));
      } catch (err) {
        console.error("[init] failed to load from Supabase:", err);
      } finally {
        saveReadyRef.current = true;
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    // Skip the first fire after init — data was just loaded FROM the DB,
    // no need to write it back immediately.
    if (!saveReadyRef.current) return;
    const ts = new Date().toISOString();
    pendingTimestampsRef.current.add(ts);
    setSyncStatus("syncing");
    saveToDB("mothers_v1", mothers, ts)
      .then(() => setSyncStatus("live"))
      .catch((err) => { console.error("[supabase] mothers save failed:", err); setSyncStatus("error"); })
      .finally(() => { setTimeout(() => pendingTimestampsRef.current.delete(ts), 3000); });
  }, [mothers]);

  useEffect(() => {
    if (!saveReadyRef.current) return;
    const ts = new Date().toISOString();
    pendingTimestampsRef.current.add(ts);
    saveToDB("room_v1", [...roomSpots], ts)
      .catch((err) => console.error("[supabase] room save failed:", err))
      .finally(() => { setTimeout(() => pendingTimestampsRef.current.delete(ts), 3000); });
  }, [roomSpots]);

  useEffect(() => {
    if (!saveReadyRef.current) return;
    const ts = new Date().toISOString();
    facilityPendingRef.current.add(ts);
    saveToDB("facility_v1", facility, ts)
      .catch((err) => console.error("[supabase] facility save failed:", err))
      .finally(() => { setTimeout(() => facilityPendingRef.current.delete(ts), 3000); });
  }, [facility]);

  // Real-time sync: when another device saves, update our state.
  // Filters echoes of our own saves by checking the pendingTimestamps Set.
  useEffect(() => {
    const sub = subscribeToKey("mothers_v1", (value, updatedAt) => {
      if (normTs(updatedAt) && pendingTimestampsRef.current.has(normTs(updatedAt))) return;
      if (!value) return;
      setMothers(value.map(m => ({
        transplantHistory: [], amendmentLog: [], cloneLog: [],
        feedingLog: [], reductionLog: [], photos: [], createdAt: today(),
        ...m
      })));
    });
    return () => sub.unsubscribe();
  }, []);

  // Real-time sync for room layout.
  useEffect(() => {
    const sub = subscribeToKey("room_v1", (value, updatedAt) => {
      if (normTs(updatedAt) && pendingTimestampsRef.current.has(normTs(updatedAt))) return;
      if (!value) return;
      setRoomSpots(new Set(value));
    });
    return () => sub.unsubscribe();
  }, []);

  // Real-time sync for facility log.
  useEffect(() => {
    const sub = subscribeToKey("facility_v1", (value, updatedAt) => {
      if (normTs(updatedAt) && facilityPendingRef.current.has(normTs(updatedAt))) return;
      if (!value) return;
      setFacility(prev => ({ ...prev, ...value }));
    });
    return () => sub.unsubscribe();
  }, []);

  function addMother(data) {
    setMothers(prev => [{ ...defaultMother(), ...data, id: uid(), createdAt: today() }, ...prev]);
  }
  const updateMother = useCallback((id, patch) => {
    setMothers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);
  const deleteMother = useCallback((id) => {
    setMothers(prev => prev.filter(m => m.id !== id));
    setDetailMotherId(null);
  }, []);
  const addTransplant = useCallback((motherId, entry) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, transplantHistory: [...m.transplantHistory, { ...entry, id: uid() }].sort((a, b) => (a.date || "").localeCompare(b.date || "")) }
        : m
    ));
  }, []);
  const removeTransplant = useCallback((motherId, entryId) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, transplantHistory: m.transplantHistory.filter(t => t.id !== entryId) }
        : m
    ));
  }, []);
  const addAmendment = useCallback((motherId, entry) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, amendmentLog: [{ ...entry, id: uid() }, ...m.amendmentLog] }
        : m
    ));
  }, []);
  const removeAmendment = useCallback((motherId, entryId) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, amendmentLog: m.amendmentLog.filter(a => a.id !== entryId) }
        : m
    ));
  }, []);
  const addCloneEntry = useCallback((motherId, entry) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, cloneLog: [{ ...entry, id: uid() }, ...m.cloneLog] }
        : m
    ));
  }, []);
  const removeCloneEntry = useCallback((motherId, entryId) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, cloneLog: m.cloneLog.filter(c => c.id !== entryId) }
        : m
    ));
  }, []);
  const addFeedingEntry = useCallback((motherId, entry) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, feedingLog: [{ ...entry, id: uid() }, ...(m.feedingLog || [])] }
        : m
    ));
  }, []);
  const removeFeedingEntry = useCallback((motherId, entryId) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, feedingLog: (m.feedingLog || []).filter(f => f.id !== entryId) }
        : m
    ));
  }, []);
  const addReductionEntry = useCallback((motherId, entry) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, reductionLog: [{ ...entry, id: uid() }, ...(m.reductionLog || [])] }
        : m
    ));
  }, []);
  const removeReductionEntry = useCallback((motherId, entryId) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, reductionLog: (m.reductionLog || []).filter(r => r.id !== entryId) }
        : m
    ));
  }, []);
  const addPhoto = useCallback((motherId, photo) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, photos: [{ ...photo, id: uid() }, ...(m.photos || [])] }
        : m
    ));
  }, []);
  const removePhoto = useCallback((motherId, photoId) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, photos: (m.photos || []).filter(p => p.id !== photoId) }
        : m
    ));
  }, []);

  const logFacilityItem = useCallback((key, notes = "") => {
    const ts = new Date().toISOString();
    setFacility(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        log: [{ id: uid(), ts, notes }, ...(prev[key]?.log || [])],
      },
    }));
  }, []);

  const waterAll = useCallback((motherIds) => {
    const entry = { date: today(), type: "Water Only", notes: "" };
    setMothers(prev => prev.map(m =>
      motherIds.has(m.id)
        ? { ...m, feedingLog: [{ ...entry, id: uid() }, ...(m.feedingLog || [])] }
        : m
    ));
  }, []);

  const active = useMemo(() => mothers.filter(m => m.status === "Active"), [mothers]);
  const sidelined = useMemo(() => mothers.filter(m => m.status === "Sidelined"), [mothers]);
  const totalClones = useMemo(() => mothers.reduce((s, m) => s + (m.cloneLog || []).reduce((a, c) => a + (parseInt(c.count) || 0), 0), 0), [mothers]);

  // Stable callbacks for onSelectMother — deps [] because they only call stable setters
  const handleSelectMother = useCallback((m) => { setDetailMotherId(m.id); setDetailTab("Overview"); }, []);
  const handleCloseDetail = useCallback(() => setDetailMotherId(null), []);

  function openAddForm() {
    setAddForm({
      strainCode: STRAINS[0].code,
      status: "Active",
      location: "",
      healthLevel: 4,
      notes: "",
      initialContainer: "Black Pot",
      initialDate: today(),
      initialDateUnknown: false,
    });
    setTab("Add");
  }

  function submitAddForm() {
    if (!addForm.strainCode) return;
    const transplantHistory = addForm.initialContainer
      ? [{ id: uid(), container: addForm.initialContainer, date: addForm.initialDateUnknown ? null : addForm.initialDate }]
      : [];
    addMother({
      strainCode: addForm.strainCode,
      status: addForm.status,
      location: addForm.location,
      healthLevel: addForm.healthLevel,
      notes: addForm.notes,
      transplantHistory,
      amendmentLog: [],
      cloneLog: [],
      feedingLog: [],
      reductionLog: [],
      photos: [],
    });
    setAddForm(null);
    setTab("Mothers");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c09] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-900/40 border border-emerald-800/60 flex items-center justify-center shadow-lg shadow-emerald-950/50">
          <Leaf className="w-8 h-8 text-emerald-400" strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-white font-bold text-xl tracking-tight text-center">Mother Log</div>
          <div className="text-emerald-700 text-[11px] font-semibold tracking-widest uppercase text-center mt-0.5">Stacks Family Farms</div>
        </div>
        <Loader2 className="w-4 h-4 text-emerald-700 animate-spin mt-2" />
      </div>
    );
  }

  const SyncIcon = syncStatus === "syncing" ? Loader2
    : syncStatus === "error" ? AlertCircle
    : Wifi;

  return (
    <div className="min-h-screen bg-[#080c09] text-zinc-300 max-w-md mx-auto flex flex-col pb-4">
      {/* ── Header ── */}
      <div className="px-4 pt-safe pb-3 border-b border-zinc-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-900/50 border border-emerald-800/50 flex items-center justify-center flex-shrink-0">
              <Leaf className="w-[18px] h-[18px] text-emerald-400" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight tracking-tight">Mother Log</h1>
              <div className="flex items-center gap-1.5">
                <p className="text-emerald-700 text-[10px] font-semibold tracking-widest uppercase">Stacks Family Farms</p>
                <SyncIcon
                  title={syncStatus === "syncing" ? "Saving…" : syncStatus === "error" ? "Sync error" : "Live"}
                  className={`w-2.5 h-2.5 flex-shrink-0 ${
                    syncStatus === "syncing" ? "text-yellow-400 animate-spin" :
                    syncStatus === "error"   ? "text-red-500" :
                                              "text-emerald-600"
                  }`}
                  strokeWidth={2.5}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportMotherCSV(mothers)}
              title="Export CSV"
              className="w-11 h-11 flex items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 active:text-zinc-200 active:bg-zinc-800 transition-colors"
            >
              <Download className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              onClick={openAddForm}
              className="h-11 px-4 flex items-center gap-1.5 bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-emerald-950/60"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex gap-0.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-1">
          {TAB_ITEMS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => { if (key === "Add") { openAddForm(); } else { setTab(key); } }}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all duration-150 min-h-[52px] justify-center ${
                  active
                    ? "bg-emerald-800/50 text-emerald-200 border border-emerald-700/30 shadow-sm"
                    : "text-zinc-600 active:text-zinc-300 active:bg-zinc-800/50"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] ${active ? "text-emerald-300" : "text-zinc-500"}`} strokeWidth={active ? 2 : 1.75} />
                <span className={`text-[10px] font-semibold tracking-wide ${active ? "text-emerald-200" : "text-zinc-600"}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 flex-1">
        {tab === "Summary" && (
          <SummaryTab
            mothers={mothers}
            active={active}
            sidelined={sidelined}
            totalClones={totalClones}
            onSelectMother={handleSelectMother}
          />
        )}
        {tab === "Mothers" && (
          <MothersTab
            mothers={mothers}
            onSelectMother={handleSelectMother}
            onQuickWater={mid => addFeedingEntry(mid, { date: today(), type: "Water Only", notes: "" })}
            onQuickFeed={(mid, type) => addFeedingEntry(mid, { date: today(), type, notes: "" })}
            onQuickAmend={(mid, amendment, notes) => addAmendment(mid, { date: today(), amendment, notes })}
            onQuickClone={(mid, count, notes) => addCloneEntry(mid, { date: today(), count, notes })}
            onWaterAll={waterAll}
          />
        )}
        {tab === "Room" && (
          <RoomTab
            mothers={mothers}
            roomSpots={roomSpots}
            setRoomSpots={setRoomSpots}
            onSelectMother={handleSelectMother}
            onUpdateMother={updateMother}
          />
        )}
        {tab === "Facility" && (
          <FacilityTab
            facility={facility}
            onLog={logFacilityItem}
          />
        )}
        {tab === "Add" && addForm && (
          <AddMotherTab
            form={addForm}
            setForm={setAddForm}
            onSubmit={submitAddForm}
            onCancel={() => { setAddForm(null); setTab("Mothers"); }}
          />
        )}
      </div>

      {detailMotherId && (() => {
        const detailMother = mothers.find(m => m.id === detailMotherId) ?? null;
        if (!detailMother) return null;
        return (
          <MotherDetailModal
            key={detailMother.id}
            mother={detailMother}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            onClose={handleCloseDetail}
            onUpdate={(patch) => updateMother(detailMother.id, patch)}
            onDelete={() => deleteMother(detailMother.id)}
            onPrintLabel={() => printMotherLabel(detailMother, currentContainer(detailMother), detailMother.healthLevel)}
            onAddTransplant={(entry) => addTransplant(detailMother.id, entry)}
            onRemoveTransplant={(eid) => removeTransplant(detailMother.id, eid)}
            onAddAmendment={(entry) => addAmendment(detailMother.id, entry)}
            onRemoveAmendment={(eid) => removeAmendment(detailMother.id, eid)}
            onAddCloneEntry={(entry) => addCloneEntry(detailMother.id, entry)}
            onRemoveCloneEntry={(eid) => removeCloneEntry(detailMother.id, eid)}
            onAddFeedingEntry={(entry) => addFeedingEntry(detailMother.id, entry)}
            onRemoveFeedingEntry={(eid) => removeFeedingEntry(detailMother.id, eid)}
            onAddReductionEntry={(entry) => addReductionEntry(detailMother.id, entry)}
            onRemoveReductionEntry={(eid) => removeReductionEntry(detailMother.id, eid)}
            onAddPhoto={(photo) => addPhoto(detailMother.id, photo)}
            onRemovePhoto={(photoId) => removePhoto(detailMother.id, photoId)}
          />
        );
      })()}
    </div>
  );
}

// ── Summary Tab ────────────────────────────────────────────────────────────
const SummaryTab = memo(function SummaryTab({ mothers, active, sidelined, totalClones, onSelectMother }) {
  const todayDay = new Date().getDay(); // 0=Sun, 6=Sat
  const isSaturday = todayDay === 6;

  // Needs water: Active mothers not fed in 3+ days (or never fed)
  const needsWater = active.filter(m => {
    const last = lastFeedingDate(m.feedingLog);
    const days = daysSince(last);
    return days === null || days >= 3;
  });

  // Sidelined plants need daily water except Saturday
  const vegOverdue = mothers.filter(m => m.status === "Active" && daysInVeg(m) >= 30);

  const sidelinedNeedsWater = isSaturday ? [] : sidelined.filter(m => {
    const last = lastFeedingDate(m.feedingLog);
    const days = daysSince(last);
    return days === null || days >= 1;
  });

  const strainCounts = mothers.reduce((acc, m) => {
    const s = getStrain(m.strainCode);
    const key = `${s.code} – ${s.name}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byHealth = [5, 4, 3, 2, 1].map(h => ({ h, cnt: mothers.filter(m => m.healthLevel === h).length })).filter(x => x.cnt > 0);
  const healthLabels = { 5: "Excellent (5)", 4: "Good (4)", 3: "Moderate (3)", 2: "Fair (2)", 1: "Poor (1)" };
  const healthClasses = {
    5: "bg-emerald-900/40 border-emerald-700/40 text-emerald-300",
    4: "bg-emerald-900/30 border-emerald-800/40 text-emerald-400",
    3: "bg-yellow-900/40 border-yellow-700/40 text-yellow-300",
    2: "bg-red-900/30 border-red-800/40 text-red-400",
    1: "bg-red-900/40 border-red-700/40 text-red-300",
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Total Mothers" value={mothers.length} colorClass="text-zinc-200" />
        <StatBox label="Active" value={active.length} colorClass="text-emerald-400" />
        <StatBox label="Total Clones" value={totalClones} colorClass="text-sky-400" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Sidelined" value={sidelined.length} colorClass="text-zinc-500" />
        <StatBox label="Strains" value={new Set(mothers.map(m => m.strainCode)).size} colorClass="text-violet-400" />
      </div>

      {byHealth.length > 0 && (
        <div>
          <SectionLabel>Health Breakdown</SectionLabel>
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden">
            {byHealth.map(({ h, cnt }) => (
              <div key={h} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 last:border-0">
                <span className="text-xs text-zinc-300">{healthLabels[h]}</span>
                <Badge label={cnt} colorClass={healthClasses[h]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(strainCounts).length > 0 && (
        <div>
          <SectionLabel>By Strain</SectionLabel>
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden">
            {Object.entries(strainCounts).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => (
              <div key={name} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 last:border-0">
                <span className="text-xs text-zinc-300">{name}</span>
                <span className="text-xs text-zinc-500">{cnt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {needsWater.length > 0 && (
        <div>
          <SectionLabel>Needs Water / Feeding</SectionLabel>
          <div className="space-y-2">
            {needsWater.map(m => {
              const s = getStrain(m.strainCode);
              const last = lastFeedingDate(m.feedingLog);
              const days = daysSince(last);
              return (
                <button key={m.id} onClick={() => onSelectMother(m)} className="press-card w-full bg-sky-950/30 border border-sky-800/40 rounded-2xl px-4 py-3.5 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-sky-300 font-medium">{s.code} – {s.name}</div>
                      {m.location && <div className="text-xs text-zinc-500 mt-0.5">{m.location}</div>}
                    </div>
                    <span className={`text-xs font-bold ${feedingDaysColor(days)}`}>
                      {days === null ? "Never fed" : `${days}d ago`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {vegOverdue.length > 0 && (
        <div>
          <SectionLabel>Veg Overdue — Cut or Clone</SectionLabel>
          <div className="space-y-2">
            {vegOverdue.map(m => {
              const s = getStrain(m.strainCode);
              return (
                <button key={m.id} onClick={() => onSelectMother(m)} className="press-card w-full bg-zinc-900 border border-red-900/50 rounded-2xl px-4 py-3.5 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-red-400 font-medium">{s.code} – {s.name}</div>
                      {m.location && <div className="text-xs text-zinc-500 mt-0.5">{m.location}</div>}
                    </div>
                    <span className="text-red-400 text-sm font-bold">{daysInVeg(m)}d</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sidelinedNeedsWater.length > 0 && (
        <div>
          <SectionLabel>Sidelined — Needs Water</SectionLabel>
          <div className="space-y-2">
            {sidelinedNeedsWater.map(m => {
              const s = getStrain(m.strainCode);
              const last = lastFeedingDate(m.feedingLog);
              const days = daysSince(last);
              return (
                <button key={m.id} onClick={() => onSelectMother(m)} className="press-card w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl px-4 py-3.5 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-zinc-300 font-medium">{s.code} – {s.name}</div>
                      {m.location && <div className="text-xs text-zinc-500 mt-0.5">{m.location}</div>}
                    </div>
                    <span className={`text-xs font-bold ${feedingDaysColor(days)}`}>
                      {days === null ? "Never fed" : `${days}d ago`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sidelined.filter(m => !sidelinedNeedsWater.includes(m)).length > 0 && (
        <div>
          <SectionLabel>Sidelined</SectionLabel>
          <div className="space-y-2">
            {sidelined.filter(m => !sidelinedNeedsWater.includes(m)).map(m => {
              const s = getStrain(m.strainCode);
              return (
                <button key={m.id} onClick={() => onSelectMother(m)} className="press-card w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl px-4 py-3.5 text-left">
                  <div className="text-sm text-zinc-400 font-medium">{s.code} – {s.name}</div>
                  {m.location && <div className="text-xs text-zinc-500 mt-0.5">{m.location}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mothers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 px-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full text-center space-y-4">
            <div className="text-4xl mb-2">🌿</div>
            <div className="text-white font-semibold text-base">No mother plants yet</div>
            <div className="text-zinc-500 text-sm leading-relaxed">
              Tap <span className="text-emerald-400 font-medium">+ Add Mother</span> to get started
            </div>
            <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-4 text-left space-y-2 mt-2">
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">What you can track</div>
              <div className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-emerald-500 mt-0.5">•</span>
                <span>Health level, status, and VEG room location</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-emerald-500 mt-0.5">•</span>
                <span>Container transplant history</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-emerald-500 mt-0.5">•</span>
                <span>Amendment log with dates</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-emerald-500 mt-0.5">•</span>
                <span>Clone cuts — send directly to Clone Log</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Mothers Tab ────────────────────────────────────────────────────────────
const MotherCard = memo(function MotherCard({ m, isOpen, onSwipeOpen, onSwipeClose, onOpenQuickLog, onQuickWater, onOpenAmend, onOpenClone }) {
  const showClone = m.status !== "Sidelined";
  const ACTION_W = showClone ? 144 : 96;
  const touchStartX = useRef(null);
  const swipeDidFire = useRef(false);

  const s = getStrain(m.strainCode);
  const container = currentContainer(m);
  const txDate = currentTransplantDate(m);
  const days = daysSince(txDate);
  const totalClones = m.cloneLog.reduce((a, c) => a + (parseInt(c.count) || 0), 0);
  const lastFed = lastFeedingDate(m.feedingLog || []);
  const fedDays = daysSince(lastFed);
  const vegDays = daysInVeg(m);

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    swipeDidFire.current = false;
  }
  function handleTouchMove(e) {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    if (Math.abs(dx) > 10) e.preventDefault();
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (dx > 40) { swipeDidFire.current = true; onSwipeOpen(); }
    else if (dx < -40) { swipeDidFire.current = true; onSwipeClose(); }
    touchStartX.current = null;
  }
  function handleCardClick() {
    if (swipeDidFire.current) { swipeDidFire.current = false; return; }
    if (isOpen) { onSwipeClose(); return; }
    onOpenQuickLog(m.id);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Action buttons revealed on swipe */}
      <div className="absolute right-0 top-0 bottom-0 flex" style={{ width: ACTION_W }}>
        <button
          onClick={() => { onSwipeClose(); onQuickWater(m.id); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-sky-900 active:bg-sky-800 transition-colors"
        >
          <span className="text-base leading-none">💧</span>
          <span className="text-[9px] font-semibold text-sky-300 leading-none">Water</span>
        </button>
        <button
          onClick={() => { onSwipeClose(); onOpenAmend(m.id); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-violet-900 active:bg-violet-800 transition-colors"
        >
          <span className="text-base leading-none">🌿</span>
          <span className="text-[9px] font-semibold text-violet-300 leading-none">Amend</span>
        </button>
        {showClone && (
          <button
            onClick={() => { onSwipeClose(); onOpenClone(m.id); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-emerald-900 active:bg-emerald-800 transition-colors"
          >
            <span className="text-base leading-none">✂️</span>
            <span className="text-[9px] font-semibold text-emerald-300 leading-none">Clone</span>
          </button>
        )}
      </div>
      {/* Sliding card */}
      <div
        style={{ transform: `translateX(${isOpen ? -ACTION_W : 0}px)`, transition: "transform 0.2s ease" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
        className={`press-card w-full bg-zinc-900/80 border border-zinc-800/80 border-l-2 ${cardAccentColor(m)} rounded-2xl px-4 py-3.5 text-left cursor-pointer select-none`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">{s.code}</span>
              <Badge label={m.status} colorClass={statusBadgeColor(m.status)} />
            </div>
            <div className="text-xs text-zinc-400 mt-0.5 truncate">{s.name}</div>
            {m.location && <div className="text-[10px] text-zinc-600 mt-0.5">{m.location}</div>}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <HealthDots level={m.healthLevel} />
            {container && <ContainerBadge container={container} />}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          {container && <span className="text-[10px] text-zinc-600">{txDate ? `${days}d in container` : "Date unknown"}</span>}
          {totalClones > 0 && <span className="text-[10px] text-zinc-600">{totalClones} clones</span>}
          {lastFed && <span className={`text-[10px] font-medium ${feedingDaysColor(fedDays)}`}>fed {fedDays}d ago</span>}
          <span className={`text-[10px] font-medium ${m.status === "Active" ? vegDaysColor(vegDays) : "text-zinc-600"}`}>{vegDays}d veg{m.status === "Active" && vegDays >= 25 ? " ⚠" : ""}</span>
        </div>
      </div>
    </div>
  );
});

// ── Strain Group (collapsible) ──────────────────────────────────────────────
const StrainGroup = memo(function StrainGroup({
  group, isCollapsed, onToggle,
  swipedId, onSwipeOpen, onSwipeClose,
  onOpenQuickLog, onQuickWater, onOpenAmend, onOpenClone,
}) {
  const cards = (
    <div className="space-y-2 mb-3">
      {group.mothers.map(m => (
        <MotherCard
          key={m.id}
          m={m}
          isOpen={swipedId === m.id}
          onSwipeOpen={() => onSwipeOpen(m.id)}
          onSwipeClose={onSwipeClose}
          onOpenQuickLog={onOpenQuickLog}
          onQuickWater={onQuickWater}
          onOpenAmend={onOpenAmend}
          onOpenClone={onOpenClone}
        />
      ))}
    </div>
  );

  // Single-mother strains: skip the collapsible header — it adds noise with no benefit
  if (group.mothers.length === 1) return cards;

  return (
    <div className="mb-1">
      <button
        onClick={() => onToggle(group.code)}
        className="w-full flex items-center gap-2 py-2 px-0.5 min-h-[44px]"
      >
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="w-0.5 h-4 rounded-full bg-zinc-700 flex-shrink-0" />
          <span className="text-xs font-bold text-zinc-400 truncate">{group.name}</span>
          <span className="text-[10px] font-semibold bg-emerald-950/80 text-emerald-500 border border-emerald-800/50 rounded-full px-1.5 py-0.5 flex-shrink-0">
            {group.mothers.length}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-600 flex-shrink-0 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}
          strokeWidth={2.5}
        />
      </button>
      {!isCollapsed && cards}
    </div>
  );
});

function MothersTab({ mothers, onSelectMother, onQuickWater, onQuickFeed, onQuickAmend, onQuickClone, onWaterAll }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [swipedId, setSwipedId] = useState(null);
  const [quickLogSheet, setQuickLogSheet] = useState(null); // null | { motherId }
  const [quickSheet, setQuickSheet] = useState(null); // null | { type: 'amend'|'clone', motherId }
  const [amendInput, setAmendInput] = useState({ amendment: "", notes: "", search: "" });
  const [cloneInput, setCloneInput] = useState({ count: "", notes: "" });
  const [collapsed, setCollapsed] = useState(new Set());
  const [waterAllSheet, setWaterAllSheet] = useState(false);
  const [toast, setToast] = useState(null);

  const filtered = useMemo(() => mothers
    .filter(m => filter === "All" || m.status === filter)
    .filter(m => {
      if (!search.trim()) return true;
      const s = getStrain(m.strainCode);
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.code.includes(q) || (m.location || "").toLowerCase().includes(q);
    }), [mothers, filter, search]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const m of filtered) {
      if (!map.has(m.strainCode)) map.set(m.strainCode, []);
      map.get(m.strainCode).push(m);
    }
    return [...map.entries()]
      .map(([code, moms]) => ({ code, name: getStrain(code).name, mothers: moms }))
      .sort((a, b) => a.name.localeCompare(b.name));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const handleToggle = useCallback((code) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }, []);
  const handleSwipeOpen = useCallback((id) => setSwipedId(id), []);
  const handleSwipeClose = useCallback(() => setSwipedId(null), []);
  const handleOpenAmend = useCallback((mid) => setQuickSheet({ type: "amend", motherId: mid }), []);
  const handleOpenClone = useCallback((mid) => setQuickSheet({ type: "clone", motherId: mid }), []);
  const handleOpenQuickLog = useCallback((mid) => { setSwipedId(null); setQuickLogSheet({ motherId: mid }); }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function closeSheet() {
    setQuickSheet(null);
    setQuickLogSheet(null);
    setAmendInput({ amendment: "", notes: "", search: "" });
    setCloneInput({ count: "", notes: "" });
  }

  function handleAmendConfirm() {
    if (!amendInput.amendment.trim()) return;
    onQuickAmend(quickSheet.motherId, amendInput.amendment.trim(), amendInput.notes.trim());
    closeSheet();
  }

  function handleCloneConfirm() {
    const count = parseInt(cloneInput.count);
    if (!count || count < 1) return;
    onQuickClone(quickSheet.motherId, count, cloneInput.notes.trim());
    closeSheet();
  }

  return (
    <div className="space-y-3">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-sky-900 border border-sky-700 text-sky-100 text-sm font-semibold px-4 py-2 rounded-2xl shadow-xl pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
      <input type="text" placeholder="Search strain, code, location..." value={search} onChange={e => setSearch(e.target.value)} className={inputCls} />
      <div className="flex gap-1.5 flex-wrap">
        {["All", "Active", "Sidelined"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors min-h-[36px] flex items-center ${filter === f ? "bg-zinc-700 text-white" : "bg-zinc-900/80 border border-zinc-800 text-zinc-500 active:text-zinc-200"}`}>
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        mothers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full text-center space-y-3">
              <div className="text-4xl mb-2">🌿</div>
              <div className="text-white font-semibold text-base">No mother plants yet</div>
              <div className="text-zinc-500 text-sm">
                Tap the green <span className="text-emerald-400 font-medium">Add</span> button in the top right to get started
              </div>
              <div className="text-zinc-600 text-xs mt-2">
                Track health, containers, amendments, and clone cuts all in one place.
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-zinc-600 text-sm">No results.</div>
        )
      ) : (
        <div>
          {filtered.length > 1 && filter !== "Sidelined" && (
            <button
              onClick={() => setWaterAllSheet(true)}
              className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-700/80 text-zinc-400 text-sm font-semibold active:bg-zinc-800/50 active:text-zinc-200 transition-colors min-h-[44px]"
            >
              <Droplets className="w-4 h-4" strokeWidth={2} />
              Water All ({filtered.length})
            </button>
          )}
          {groups.map(group => (
            <StrainGroup
              key={group.code}
              group={group}
              isCollapsed={collapsed.has(group.code)}
              onToggle={handleToggle}
              swipedId={swipedId}
              onSwipeOpen={handleSwipeOpen}
              onSwipeClose={handleSwipeClose}
              onOpenQuickLog={handleOpenQuickLog}
              onQuickWater={onQuickWater}
              onOpenAmend={handleOpenAmend}
              onOpenClone={handleOpenClone}
            />
          ))}
        </div>
      )}

      {/* Quick Log sheet — tap a card to log */}
      {quickLogSheet && (() => {
        const qlMother = mothers.find(m => m.id === quickLogSheet.motherId);
        if (!qlMother) return null;
        const qlStrain = getStrain(qlMother.strainCode);
        const showClone = qlMother.status !== "Sidelined";
        function logFeed(type) {
          onQuickFeed(quickLogSheet.motherId, type);
          setQuickLogSheet(null);
          showToast(`${type} — ${qlStrain.code}`);
        }
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setQuickLogSheet(null); }}>
            <div className="bg-[#0e1512] border border-zinc-700/50 rounded-t-3xl w-full max-w-md shadow-2xl">
              <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-zinc-700" /></div>
              <div className="px-5 pb-6 pt-2 space-y-4">
                {/* Header */}
                <div>
                  <div className="text-base font-bold text-white">{qlStrain.code} — {qlStrain.name}</div>
                  {qlMother.location && <div className="text-xs text-zinc-500 mt-0.5">{qlMother.location}</div>}
                </div>
                {/* Feeding row */}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => logFeed("Water Only")} className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-sky-900/60 border border-sky-800/50 active:bg-sky-800 transition-colors min-h-[72px]">
                    <Droplets className="w-5 h-5 text-sky-400" strokeWidth={2} />
                    <span className="text-[10px] font-semibold text-sky-300 leading-none">Water</span>
                  </button>
                  <button onClick={() => logFeed("Light Feed")} className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-teal-900/60 border border-teal-800/50 active:bg-teal-800 transition-colors min-h-[72px]">
                    <Leaf className="w-5 h-5 text-teal-400" strokeWidth={2} />
                    <span className="text-[10px] font-semibold text-teal-300 leading-none">Light Feed</span>
                  </button>
                  <button onClick={() => logFeed("Full Feed")} className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-green-900/60 border border-green-800/50 active:bg-green-800 transition-colors min-h-[72px]">
                    <Leaf className="w-5 h-5 text-green-400" strokeWidth={2} />
                    <span className="text-[10px] font-semibold text-green-300 leading-none">Full Feed</span>
                  </button>
                </div>
                {/* Amend + Clone row */}
                <div className={`grid gap-2 ${showClone ? "grid-cols-2" : "grid-cols-1"}`}>
                  <button onClick={() => { setQuickLogSheet(null); handleOpenAmend(quickLogSheet.motherId); }} className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-violet-900/60 border border-violet-800/50 active:bg-violet-800 transition-colors min-h-[72px]">
                    <FlaskConical className="w-5 h-5 text-violet-400" strokeWidth={2} />
                    <span className="text-[10px] font-semibold text-violet-300 leading-none">Amendment</span>
                  </button>
                  {showClone && (
                    <button onClick={() => { setQuickLogSheet(null); handleOpenClone(quickLogSheet.motherId); }} className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-emerald-900/60 border border-emerald-800/50 active:bg-emerald-800 transition-colors min-h-[72px]">
                      <Scissors className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                      <span className="text-[10px] font-semibold text-emerald-300 leading-none">Clone Cut</span>
                    </button>
                  )}
                </div>
                {/* View full details */}
                <button onClick={() => { setQuickLogSheet(null); onSelectMother(qlMother); }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-semibold active:bg-zinc-800/60 transition-colors min-h-[44px]">
                  View Full Details
                  <ChevronRight className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Water All confirm sheet */}
      {waterAllSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setWaterAllSheet(false); }}>
          <div className="bg-[#0e1512] border border-zinc-700/50 rounded-t-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-zinc-700" /></div>
            <div className="px-5 pb-6 pt-2 space-y-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-sky-400" strokeWidth={2} />
                <div className="text-sm font-bold text-white">Water All</div>
              </div>
              <div className="text-zinc-400 text-sm">Log water for all {filtered.length} visible mothers?</div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setWaterAllSheet(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-semibold">Cancel</button>
                <button
                  onClick={() => {
                    const count = filtered.length;
                    onWaterAll(new Set(filtered.map(m => m.id)));
                    setWaterAllSheet(false);
                    showToast(`Watered ${count} mother${count !== 1 ? "s" : ""}`);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-sky-700 active:bg-sky-600 text-white text-sm font-semibold transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick-log bottom sheets */}
      {quickSheet?.type === "amend" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) closeSheet(); }}>
          <div className="bg-[#0e1512] border border-zinc-700/50 rounded-t-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-zinc-700" />
            </div>
            <div className="px-5 pb-6 pt-2 space-y-3">
              <div className="text-sm font-bold text-white">Quick Amend</div>
              <div>
                <input
                  type="text"
                  placeholder="Search or type amendment..."
                  className={inputCls}
                  value={amendInput.search !== "" ? amendInput.search : amendInput.amendment}
                  onChange={e => setAmendInput(p => ({ ...p, search: e.target.value, amendment: e.target.value }))}
                  onFocus={() => { if (!amendInput.search) setAmendInput(p => ({ ...p, search: p.amendment || "" })); }}
                  autoFocus
                />
                {amendInput.search && (
                  <div className="mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                    {COMMON_AMENDMENTS.filter(a => a.toLowerCase().includes(amendInput.search.toLowerCase())).map(a => (
                      <button key={a} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors" onClick={() => setAmendInput(p => ({ ...p, amendment: a, search: "" }))}>
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="Notes (optional)"
                className={inputCls}
                value={amendInput.notes}
                onChange={e => setAmendInput(p => ({ ...p, notes: e.target.value }))}
              />
              <div className="flex gap-2 pt-1">
                <button onClick={closeSheet} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-semibold">Cancel</button>
                <button
                  onClick={handleAmendConfirm}
                  disabled={!amendInput.amendment.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-violet-700 text-white text-sm font-semibold disabled:opacity-40 active:bg-violet-600 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {quickSheet?.type === "clone" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) closeSheet(); }}>
          <div className="bg-[#0e1512] border border-zinc-700/50 rounded-t-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-zinc-700" />
            </div>
            <div className="px-5 pb-6 pt-2 space-y-3">
              <div className="text-sm font-bold text-white">Quick Clone</div>
              <input
                type="number"
                min="1"
                placeholder="Count"
                className={inputCls}
                value={cloneInput.count}
                onChange={e => setCloneInput(p => ({ ...p, count: e.target.value }))}
                autoFocus
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                className={inputCls}
                value={cloneInput.notes}
                onChange={e => setCloneInput(p => ({ ...p, notes: e.target.value }))}
              />
              <div className="flex gap-2 pt-1">
                <button onClick={closeSheet} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-semibold">Cancel</button>
                <button
                  onClick={handleCloneConfirm}
                  disabled={!cloneInput.count || parseInt(cloneInput.count) < 1}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-semibold disabled:opacity-40 active:bg-emerald-600 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Room Tab ───────────────────────────────────────────────────────────────
const BENCHES = [
  { id: 1, label: "Bench 1", desc: "Mothers only", accent: "emerald", lower: true },
  { id: 2, label: "Bench 2", desc: "Mostly mothers", accent: "sky" },
  { id: 3, label: "Bench 3", desc: "Mostly upcoming", accent: "violet" },
  { id: 4, label: "Bench 4", desc: "Upcoming rounds", accent: "indigo" },
];
const SPOTS_PER_BENCH = 7;

function parseLocation(loc) {
  if (!loc) return null;
  const m = loc.match(/B(\d+)-S(\d+)/);
  return m ? { bench: parseInt(m[1]), spot: parseInt(m[2]) } : null;
}
function locationKey(bench, spot) { return `B${bench}-S${spot}`; }

function worstHealth(spotMothers) {
  if (!spotMothers.length) return null;
  return Math.min(...spotMothers.map(m => m.healthLevel));
}

const SpotCell = memo(function SpotCell({ bench, spot, spotMothers, isUpcoming, onCellClick }) {
  const type = spotMothers.length > 0 ? "mother" : isUpcoming ? "upcoming" : "empty";
  function handleClick() { onCellClick(bench, spot); }

  if (type === "mother") {
    const worst = worstHealth(spotMothers);
    const bgCls = worst <= 2 ? "bg-red-950" : worst === 3 ? "bg-amber-950" : "bg-emerald-950";
    const borderCls = worst <= 2 ? "border-red-600" : worst === 3 ? "border-yellow-600" : "border-green-600";
    const textCls = worst <= 2 ? "text-red-300" : worst === 3 ? "text-yellow-200" : "text-green-200";
    const dotCls = worst <= 2 ? "bg-red-400" : worst === 3 ? "bg-yellow-400" : "bg-emerald-400";
    const multi = spotMothers.length > 1;
    return (
      <button
        onClick={handleClick}
        className={`aspect-square rounded-lg border ${bgCls} ${borderCls} flex flex-col items-center justify-center gap-0.5 p-0.5 w-full`}
      >
        {multi ? (
          <>
            <span className={`text-[8px] font-bold leading-none ${textCls}`}>{spotMothers.length}x</span>
            <div className="flex flex-wrap gap-[2px] justify-center">
              {spotMothers.map(m => (
                <div
                  key={m.id}
                  className={`w-1.5 h-1.5 rounded-full ${m.healthLevel <= 2 ? "bg-red-400" : m.healthLevel === 3 ? "bg-yellow-400" : "bg-emerald-400"}`}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <span className={`text-[8px] font-bold leading-none truncate max-w-full px-0.5 ${textCls}`}>{getStrain(spotMothers[0].strainCode).code}</span>
            <div className="flex gap-[2px] justify-center">
              {[1,2,3,4,5].map(i => (
                <div key={i} className={`w-1 h-1 rounded-full ${i <= spotMothers[0].healthLevel ? dotCls : "bg-zinc-700"}`} />
              ))}
            </div>
          </>
        )}
      </button>
    );
  }

  if (type === "upcoming") {
    return (
      <button
        onClick={handleClick}
        className="aspect-square rounded-lg border border-indigo-700/50 bg-indigo-900/20 flex flex-col items-center justify-center gap-0.5 w-full"
      >
        <span className="text-[8px] font-bold text-indigo-300 leading-none">RND</span>
        <span className="text-[7px] text-indigo-500 leading-none">upcoming</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="aspect-square rounded-lg border border-dashed border-zinc-800 flex items-center justify-center w-full hover:border-zinc-600 transition-colors"
    >
      <span className="text-zinc-700 text-sm leading-none">+</span>
    </button>
  );
});

function SpotSheet({ bench, spot, spotMothers, isUpcoming, mothers, onClose, onSelectMother, onUpdateMother, onMarkUpcoming, onClearUpcoming }) {
  const key = locationKey(bench, spot);
  const [selectedMotherId, setSelectedMotherId] = useState("");
  const unassigned = mothers.filter(m => !parseLocation(m.location) || m.location === key);

  function assignMother() {
    if (!selectedMotherId) return;
    onUpdateMother(selectedMotherId, { location: key });
    onClose();
  }

  return (
    <Modal title={`Bench ${bench} · Spot ${spot}`} onClose={onClose}>
      <div className="space-y-4">
        {spotMothers.length > 0 && (
          <div>
            <SectionLabel>Plants in this spot</SectionLabel>
            <div className="space-y-2">
              {spotMothers.map(m => {
                const s = getStrain(m.strainCode);
                return (
                  <div key={m.id} className="flex items-center justify-between bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2.5">
                    <button onClick={() => { onSelectMother(m); onClose(); }} className="flex-1 text-left">
                      <div className="text-sm font-bold text-emerald-300">{s.code}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{s.name}</div>
                      <HealthDots level={m.healthLevel} />
                    </button>
                    <button
                      onClick={() => { onUpdateMother(m.id, { location: "" }); onClose(); }}
                      className="text-zinc-600 hover:text-red-400 text-xs ml-3 border border-zinc-700 hover:border-red-700/50 rounded-lg px-2 py-1 transition-colors flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isUpcoming && spotMothers.length === 0 && (
          <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-xl px-4 py-3 text-center">
            <div className="text-sm font-bold text-indigo-300 mb-1">Upcoming Round</div>
            <div className="text-xs text-zinc-400">This spot is reserved for the next round.</div>
          </div>
        )}

        {isUpcoming && (
          <button onClick={() => { onClearUpcoming(key); onClose(); }} className="w-full border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs rounded-xl py-2.5 transition-colors">
            Clear Upcoming Slot
          </button>
        )}

        {!isUpcoming && spotMothers.length === 0 && (
          <button onClick={() => { onMarkUpcoming(key); onClose(); }} className="w-full bg-indigo-900/30 border border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/50 text-xs font-semibold rounded-xl py-2.5 transition-colors">
            Mark as Upcoming Round
          </button>
        )}

        <div>
          <SectionLabel>Assign a mother to this spot</SectionLabel>
          <div className="flex gap-2">
            <select
              className={selectCls + " flex-1"}
              value={selectedMotherId}
              onChange={e => setSelectedMotherId(e.target.value)}
            >
              <option value="">Select mother...</option>
              {unassigned.map(m => {
                const s = getStrain(m.strainCode);
                return <option key={m.id} value={m.id}>{s.code} – {s.name}{m.location ? ` (${m.location})` : ""}</option>;
              })}
            </select>
            <button
              onClick={assignMother}
              disabled={!selectedMotherId}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-semibold px-3 rounded-xl transition-colors flex-shrink-0"
            >
              Assign
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function RoomTab({ mothers, roomSpots, setRoomSpots, onSelectMother, onUpdateMother }) {
  const [activeSpot, setActiveSpot] = useState(null); // { bench, spot }

  const handleCellClick = useCallback((bench, spot) => {
    setActiveSpot({ bench, spot });
  }, []);

  function markUpcoming(key) {
    setRoomSpots(prev => new Set([...prev, key]));
  }
  function clearUpcoming(key) {
    setRoomSpots(prev => { const n = new Set(prev); n.delete(key); return n; });
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-2">
        <span className="text-base">🚪</span>
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Entrance</span>
      </div>

      {BENCHES.map(bench => {
        const accentMap = {
          emerald: "text-emerald-400 border-emerald-800/40",
          sky: "text-sky-400 border-sky-800/40",
          violet: "text-violet-400 border-violet-800/40",
          indigo: "text-indigo-400 border-indigo-800/40",
        };
        const accentCls = accentMap[bench.accent] || "text-zinc-400 border-zinc-800";

        return (
          <div key={bench.id} className={bench.lower ? "mt-2 ml-2" : ""}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold ${accentCls.split(" ")[0]}`}>{bench.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${accentCls} bg-zinc-900`}>{bench.desc}</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: SPOTS_PER_BENCH }, (_, i) => {
                const spot = i + 1;
                const key = locationKey(bench.id, spot);
                const spotMothers = mothers.filter(m => m.location === key);
                const isUpcoming = roomSpots.has(key);
                return (
                  <SpotCell
                    key={key}
                    bench={bench.id}
                    spot={spot}
                    spotMothers={spotMothers}
                    isUpcoming={isUpcoming}
                    onCellClick={handleCellClick}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/60 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-green-600 bg-emerald-950" />
          <span className="text-[10px] text-zinc-500">Excellent/Good</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-yellow-600 bg-amber-950" />
          <span className="text-[10px] text-zinc-500">Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-red-600 bg-red-950" />
          <span className="text-[10px] text-zinc-500">Poor/Fair</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-indigo-700/50 bg-indigo-900/20" />
          <span className="text-[10px] text-zinc-500">Upcoming</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-dashed border border-zinc-800" />
          <span className="text-[10px] text-zinc-500">Empty</span>
        </div>
      </div>

      {activeSpot && (
        <SpotSheet
          bench={activeSpot.bench}
          spot={activeSpot.spot}
          spotMothers={mothers.filter(m => m.location === locationKey(activeSpot.bench, activeSpot.spot))}
          isUpcoming={roomSpots.has(locationKey(activeSpot.bench, activeSpot.spot))}
          mothers={mothers}
          onClose={() => setActiveSpot(null)}
          onSelectMother={onSelectMother}
          onUpdateMother={onUpdateMother}
          onMarkUpcoming={markUpcoming}
          onClearUpcoming={clearUpcoming}
        />
      )}
    </div>
  );
}

// ── Facility Tab ────────────────────────────────────────────────────────────
function facilityDaysSince(ts) {
  if (!ts) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 86400000));
}
function facilityBorderColor(days) {
  if (days === null) return "border-l-zinc-700";
  if (days <= 2) return "border-l-emerald-600";
  if (days <= 7) return "border-l-yellow-500";
  return "border-l-red-600";
}
function facilityAgeText(days) {
  if (days === null) return "Never logged";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
function facilityAgeColor(days) {
  if (days === null) return "text-zinc-600";
  if (days <= 2) return "text-emerald-400";
  if (days <= 7) return "text-yellow-400";
  return "text-red-400";
}

const FacilityItem = memo(function FacilityItem({ itemKey, data, onLog }) {
  const lastEntry = (Array.isArray(data?.log) ? data.log[0] : null) ?? null;
  const days = facilityDaysSince(lastEntry?.ts ?? null);
  return (
    <div className={`bg-zinc-900/80 border border-zinc-800 border-l-2 ${facilityBorderColor(days)} rounded-2xl px-4 py-3.5 flex items-center gap-3`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-zinc-200 truncate">{data.label}</div>
        <div className={`text-xs font-medium mt-0.5 ${facilityAgeColor(days)}`}>
          {facilityAgeText(days)}
          {lastEntry && days !== 0 && (
            <span className="text-zinc-700 ml-1.5">
              · {new Date(lastEntry.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onLog(itemKey)}
        className="flex-shrink-0 py-2 px-4 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold active:bg-zinc-700 active:text-white transition-colors min-h-[44px] flex items-center justify-center"
      >
        Log Now
      </button>
    </div>
  );
});

function FacilityTab({ facility, onLog }) {
  const [logSheet, setLogSheet] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [toast, setToast] = useState(null);

  function openLog(key) { setLogSheet(key); setNoteInput(""); }
  function closeLog() { setLogSheet(null); setNoteInput(""); }
  function confirmLog() {
    const label = facility[logSheet]?.label ?? logSheet;
    onLog(logSheet, noteInput.trim());
    closeLog();
    setToast(`${label} logged`);
    setTimeout(() => setToast(null), 2000);
  }

  return (
    <div className="space-y-5 pt-1 pb-6">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-900 border border-emerald-700 text-emerald-100 text-sm font-semibold px-4 py-2 rounded-2xl shadow-xl pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
      {FACILITY_SECTIONS.map(section => (
        <div key={section.label}>
          <SectionLabel>{section.label}</SectionLabel>
          <div className="space-y-2">
            {section.items.map(key => (
              <FacilityItem
                key={key}
                itemKey={key}
                data={facility[key] || DEFAULT_FACILITY[key]}
                onLog={openLog}
              />
            ))}
          </div>
        </div>
      ))}

      {logSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeLog(); }}
        >
          <div className="bg-[#0e1512] border border-zinc-700/50 rounded-t-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-zinc-700" /></div>
            <div className="px-5 pb-6 pt-2 space-y-3">
              <div className="text-sm font-bold text-white">
                {facility[logSheet]?.label ?? logSheet}
              </div>
              <input
                type="text"
                placeholder="Notes (optional)"
                className={inputCls}
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 pt-1">
                <button onClick={closeLog} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm font-semibold">Cancel</button>
                <button onClick={confirmLog} className="flex-1 py-2.5 rounded-xl bg-emerald-700 active:bg-emerald-600 text-white text-sm font-semibold transition-colors">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Mother Tab ─────────────────────────────────────────────────────────
function AddMotherTab({ form, setForm, onSubmit, onCancel }) {
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h2 className="text-white font-semibold text-sm">Add Mother Plant</h2>
        <p className="text-zinc-600 text-xs mt-0.5">Fill in the details below</p>
      </div>
      <FormField label="Strain">
        <select className={selectCls} value={form.strainCode} onChange={e => f("strainCode", e.target.value)}>
          {STRAINS.map(s => <option key={s.code} value={s.code}>{s.code} – {s.name}</option>)}
        </select>
      </FormField>
      <FormField label="Status">
        <div className="flex gap-2">
          {MOTHER_STATUSES.map(s => (
            <button key={s} onClick={() => f("status", s)} className={`flex-1 text-xs py-2 rounded-xl font-bold border transition-colors ${
              form.status === s
                ? s === "Active"
                  ? "bg-emerald-800/60 text-emerald-200 border-emerald-600"
                  : "bg-zinc-600 text-white border-zinc-400"
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
            }`}>
              {s}
            </button>
          ))}
        </div>
      </FormField>
      <FormField label={`Health Level — ${healthLabel(form.healthLevel)}`}>
        <div className="flex gap-2 items-center">
          {[1, 2, 3, 4, 5].map(i => (
            <button key={i} onClick={() => f("healthLevel", i)} className={`flex-1 h-8 rounded-xl border font-bold text-sm transition-colors ${form.healthLevel === i ? i <= 2 ? "bg-red-900/60 border-red-700 text-red-300" : i === 3 ? "bg-yellow-900/60 border-yellow-700 text-yellow-300" : "bg-emerald-900/60 border-emerald-700 text-emerald-300" : "bg-zinc-800 border-zinc-700 text-zinc-600"}`}>
              {i}
            </button>
          ))}
        </div>
      </FormField>
      <FormField label="VEG Room Location (optional)">
        <input type="text" placeholder="e.g. Row 2, Spot 4" className={inputCls} value={form.location} onChange={e => f("location", e.target.value)} />
      </FormField>
      <FormField label="Initial Container">
        <select className={selectCls} value={form.initialContainer} onChange={e => f("initialContainer", e.target.value)}>
          {CONTAINERS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </FormField>
      <FormField label="Date Placed in Container">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => f("initialDateUnknown", !form.initialDateUnknown)}
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors w-full ${
              form.initialDateUnknown
                ? "bg-zinc-700 border-zinc-600 text-zinc-200"
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
            }`}
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${form.initialDateUnknown ? "bg-emerald-600 border-emerald-500" : "border-zinc-600"}`}>
              {form.initialDateUnknown && <span className="text-white text-[10px]">✓</span>}
            </span>
            Date unknown — existing plant with no record
          </button>
          {!form.initialDateUnknown && (
            <input type="date" className={inputCls} value={form.initialDate} onChange={e => f("initialDate", e.target.value)} />
          )}
        </div>
      </FormField>
      <FormField label="Notes (optional)">
        <textarea className={inputCls + " resize-none"} rows={2} placeholder="Any observations..." value={form.notes} onChange={e => f("notes", e.target.value)} />
      </FormField>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button onClick={onSubmit} className={btnPrimary} disabled={!form.strainCode}>Add Mother</button>
      </div>
    </div>
  );
}

// ── Send to Clone Log Modal ───────────────────────────────────────────────
function SendToCloneLogModal({ cloneEntry, strainName, strainCode, motherLocation, onClose }) {
  const [copied, setCopied] = useState(false);

  const exportData = {
    type: "clone_import",
    strainCode: strainCode,
    strainName: strainName,
    qty: parseInt(cloneEntry.count) || 0,
    dateCloned: cloneEntry.date,
    batchNote: "From mother: " + strainName + " \u2014 Mother Log export",
    motherLocation: motherLocation || "",
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonString).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    } else {
      // Fallback for non-HTTPS / older WebViews — don't claim success if it fails
      try {
        const ta = document.createElement("textarea");
        ta.value = jsonString;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // execCommand also unavailable — nothing to do
      }
    }
  }

  return (
    <Modal title="Send to Clone Log" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3">
          <div className="text-xs text-emerald-300 font-semibold mb-1">Export Summary</div>
          <div className="text-sm text-white font-bold">{exportData.qty} clones of {strainName}</div>
          <div className="text-xs text-zinc-400 mt-0.5">Dated {fmtDate(cloneEntry.date)}</div>
          {motherLocation && <div className="text-xs text-zinc-500 mt-0.5">Location: {motherLocation}</div>}
        </div>

        <div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">JSON Package</div>
          <pre className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-[10px] text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {jsonString}
          </pre>
        </div>

        <button
          onClick={handleCopy}
          className={`w-full font-semibold text-sm rounded-xl py-3 transition-colors ${
            copied
              ? "bg-emerald-800 text-emerald-200 border border-emerald-700"
              : "bg-emerald-700 hover:bg-emerald-600 text-white"
          }`}
        >
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>

        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 space-y-1.5">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">How to import</div>
          <div className="flex items-start gap-2 text-xs text-zinc-400">
            <span className="text-sky-400 font-bold flex-shrink-0">1.</span>
            <span>Open the <span className="text-white font-medium">Clone Log</span> app</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-zinc-400">
            <span className="text-sky-400 font-bold flex-shrink-0">2.</span>
            <span>Go to the <span className="text-white font-medium">Add Entry</span> tab</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-zinc-400">
            <span className="text-sky-400 font-bold flex-shrink-0">3.</span>
            <span>Tap <span className="text-white font-medium">Import from Mother Log</span> and paste</span>
          </div>
        </div>

        <button onClick={onClose} className={btnSecondary}>Done</button>
      </div>
    </Modal>
  );
}

// ── Mother Detail Modal ────────────────────────────────────────────────────
const MotherDetailModal = memo(function MotherDetailModal({
  mother, detailTab, setDetailTab, onClose, onUpdate, onDelete, onPrintLabel,
  onAddTransplant, onRemoveTransplant,
  onAddAmendment, onRemoveAmendment,
  onAddCloneEntry, onRemoveCloneEntry,
  onAddFeedingEntry, onRemoveFeedingEntry,
  onAddReductionEntry, onRemoveReductionEntry,
  onAddPhoto, onRemovePhoto,
}) {
  const s = getStrain(mother.strainCode);
  const container = currentContainer(mother);
  const txDate = currentTransplantDate(mother);
  const daysInContainer = daysSince(txDate);
  const totalClones = mother.cloneLog.reduce((a, c) => a + (parseInt(c.count) || 0), 0);
  const vegDays = daysInVeg(mother);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState(mother.notes || "");
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingHealth, setEditingHealth] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationVal, setLocationVal] = useState(mother.location || "");
  const [sendToCloneEntry, setSendToCloneEntry] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null); // null | 'picker'

  // Modal form state — lives here so typing never re-renders the rest of the app
  const [showTransplantModal, setShowTransplantModal] = useState(false);
  const [transplantForm, setTransplantForm] = useState({ container: "Black Pot", date: today(), dateUnknown: false });
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendForm, setAmendForm] = useState({ date: today(), amendment: "", notes: "" });
  const [amendSearch, setAmendSearch] = useState("");
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneForm, setCloneForm] = useState({ date: today(), count: "", notes: "" });
  const [showFeedingModal, setShowFeedingModal] = useState(false);
  const [feedingForm, setFeedingForm] = useState({ date: today(), type: "Water Only", notes: "" });
  const [showReductionModal, setShowReductionModal] = useState(false);
  const [reductionForm, setReductionForm] = useState({ date: today(), reason: "Space", notes: "" });

  const feedingLog = mother.feedingLog || [];
  const lastFed = lastFeedingDate(feedingLog);
  const daysSinceFed = daysSince(lastFed);

  // Build history timeline once — avoids rebuilding on every render
  const timeline = useMemo(() => [
    ...[...mother.transplantHistory].map(e => ({ ...e, _type: "transplant" })),
    ...(mother.amendmentLog || []).map(e => ({ ...e, _type: "amendment" })),
    ...(mother.feedingLog || []).map(e => ({ ...e, _type: "feeding" })),
    ...(mother.cloneLog || []).map(e => ({ ...e, _type: "clone" })),
    ...(mother.reductionLog || []).map(e => ({ ...e, _type: "reduction" })),
  ].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  }), [mother.transplantHistory, mother.amendmentLog, mother.feedingLog, mother.cloneLog, mother.reductionLog]);

  return (
    <>
      <Modal title={`${s.code} – ${s.name}`} onClose={onClose}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Badge label={mother.status} colorClass={statusBadgeColor(mother.status)} />
          <Badge label={healthLabel(mother.healthLevel)} colorClass={healthBg(mother.healthLevel)} />
          {mother.location && <span className="text-xs text-zinc-500">{mother.location}</span>}
        </div>

        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-4 overflow-x-auto">
          {DETAIL_TABS.map(t => (
            <button key={t} onClick={() => setDetailTab(t)} className={`flex-shrink-0 text-[10px] font-bold py-1.5 px-2.5 rounded-lg transition-colors ${detailTab === t ? "bg-emerald-800/60 text-emerald-200 border border-emerald-700/40" : "text-zinc-500 hover:text-zinc-300"}`}>
              {t}
            </button>
          ))}
        </div>

        {detailTab === "Overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Days in Container" value={txDate ? (daysInContainer ?? "—") : "Unknown"} colorClass={txDate ? "text-sky-400" : "text-zinc-600"} />
              <StatBox label="Days in Veg" value={vegDays ?? "—"} colorClass={vegDaysColor(vegDays)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Total Clones" value={totalClones} colorClass="text-emerald-400" />
              <StatBox label="Amendments" value={mother.amendmentLog.length} colorClass="text-violet-400" />
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3">
              <SectionLabel>Current Container</SectionLabel>
              {container ? <ContainerBadge container={container} /> : <span className="text-xs text-zinc-600">No transplant recorded</span>}
              {container && <div className="text-[10px] text-zinc-600 mt-1">{txDate ? `Since ${fmtDate(txDate)}` : "Date unknown"}</div>}
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Health Level</SectionLabel>
                <button onClick={() => setEditingHealth(!editingHealth)} className="text-[10px] text-zinc-500 hover:text-zinc-300">Edit</button>
              </div>
              {editingHealth ? (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button key={i} onClick={() => { onUpdate({ healthLevel: i }); setEditingHealth(false); }} className={`flex-1 h-8 rounded-xl border font-bold text-sm transition-colors ${mother.healthLevel === i ? i <= 2 ? "bg-red-900/60 border-red-700 text-red-300" : i === 3 ? "bg-yellow-900/60 border-yellow-700 text-yellow-300" : "bg-emerald-900/60 border-emerald-700 text-emerald-300" : "bg-zinc-800 border-zinc-700 text-zinc-600"}`}>
                      {i}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <HealthDots level={mother.healthLevel} />
                  <span className={`text-sm font-medium ${healthColor(mother.healthLevel)}`}>{healthLabel(mother.healthLevel)}</span>
                </div>
              )}
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Status</SectionLabel>
                <button onClick={() => setEditingStatus(!editingStatus)} className="text-[10px] text-zinc-500 hover:text-zinc-300">Edit</button>
              </div>
              {editingStatus ? (
                <div className="flex gap-2">
                  {MOTHER_STATUSES.map(st => (
                    <button key={st} onClick={() => { onUpdate({ status: st }); setEditingStatus(false); }} className={`flex-1 text-xs py-1.5 rounded-xl border font-medium transition-colors ${statusBadgeColor(st)}`}>
                      {st}
                    </button>
                  ))}
                </div>
              ) : (
                <Badge label={mother.status} colorClass={statusBadgeColor(mother.status)} />
              )}
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <SectionLabel>VEG Room Location</SectionLabel>
                <button onClick={() => { setEditingLocation(!editingLocation); setLocationVal(mother.location || ""); }} className="text-[10px] text-zinc-500 hover:text-zinc-300">Edit</button>
              </div>
              {editingLocation ? (
                <div className="flex gap-2">
                  <input type="text" className={inputCls + " flex-1"} placeholder="e.g. Row 2, Spot 4" value={locationVal} onChange={e => setLocationVal(e.target.value)} />
                  <button onClick={() => { onUpdate({ location: locationVal }); setEditingLocation(false); }} className="bg-emerald-700 text-white text-xs px-3 rounded-xl">Save</button>
                </div>
              ) : (
                <span className="text-sm text-zinc-300">{mother.location || <span className="text-zinc-600">Not set</span>}</span>
              )}
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <SectionLabel>Notes / Observations</SectionLabel>
                <button onClick={() => { setEditingNotes(!editingNotes); setNotesVal(mother.notes || ""); }} className="text-[10px] text-zinc-500 hover:text-zinc-300">Edit</button>
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea className={inputCls + " resize-none"} rows={3} value={notesVal} onChange={e => setNotesVal(e.target.value)} />
                  <button onClick={() => { onUpdate({ notes: notesVal }); setEditingNotes(false); }} className={btnPrimary}>Save Notes</button>
                </div>
              ) : (
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{mother.notes || <span className="text-zinc-600">No notes yet.</span>}</p>
              )}
            </div>
            <button onClick={onPrintLabel} className="w-full border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs rounded-xl py-2.5 transition-colors flex items-center justify-center gap-1.5">
              Print Label
            </button>
            {confirmDelete ? (
              <div className="border border-red-800/60 rounded-xl p-3 space-y-2">
                <div className="text-xs text-red-400 text-center font-medium">Delete this mother plant? This cannot be undone.</div>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className={btnSecondary}>Cancel</button>
                  <button onClick={onDelete} className="flex-1 bg-red-800 hover:bg-red-700 text-white font-semibold text-sm rounded-xl py-2.5 transition-colors">Delete</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="w-full border border-red-900/50 text-red-500 hover:text-red-400 hover:border-red-800 text-xs rounded-xl py-2.5 transition-colors">
                Delete Mother Plant
              </button>
            )}
          </div>
        )}

        {detailTab === "History" && (() => {
          const latestTxId = mother.transplantHistory.length ? mother.transplantHistory[mother.transplantHistory.length - 1].id : null;
          function entrySummary(e) {
            if (e._type === "transplant") return `→ ${e.container}`;
            if (e._type === "amendment") return e.amendment;
            if (e._type === "feeding") return e.type;
            if (e._type === "clone") return `${e.count} clone${parseInt(e.count) !== 1 ? "s" : ""} taken`;
            if (e._type === "reduction") return e.reason;
            return "";
          }
          function removeEntry(e) {
            if (e._type === "transplant") onRemoveTransplant(e.id);
            else if (e._type === "amendment") onRemoveAmendment(e.id);
            else if (e._type === "feeding") onRemoveFeedingEntry(e.id);
            else if (e._type === "clone") onRemoveCloneEntry(e.id);
            else if (e._type === "reduction") onRemoveReductionEntry(e.id);
          }
          return (
            <div className="space-y-3">
              <button onClick={() => setActiveSheet("picker")} className={btnPrimary}>＋ Add</button>
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-sm">No history yet — tap + to log the first event.</div>
              ) : (
                <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden">
                  {timeline.map(e => {
                    const meta = TYPE_META[e._type];
                    return (
                      <div key={`${e._type}-${e.id}`} className={`flex items-start gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-0 border-l-2 ${meta.border}`}>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${meta.text}`}>
                            {meta.label}{e._type === "transplant" && e.id === latestTxId ? " · Current" : ""}
                          </div>
                          <div className="text-sm text-zinc-200 font-medium">{entrySummary(e)}</div>
                          {e.notes && <div className="text-xs text-zinc-500 mt-0.5 truncate">{e.notes}</div>}
                          <div className="text-xs text-zinc-600 mt-0.5">{e.date ? fmtDate(e.date) : "Date unknown"}</div>
                          {e._type === "clone" && (
                            <button
                              onClick={() => setSendToCloneEntry(e)}
                              className="text-[10px] text-sky-400 hover:text-sky-300 border border-sky-800/50 hover:border-sky-700 rounded-lg px-2 py-1 mt-1.5 transition-colors"
                            >
                              Send to Clone Log
                            </button>
                          )}
                        </div>
                        <button onClick={() => removeEntry(e)} className="text-zinc-700 hover:text-red-500 text-sm w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
              {activeSheet === "picker" && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setActiveSheet(null); }}>
                  <div className="bg-[#0e1512] border border-zinc-700/50 rounded-t-3xl w-full max-w-md shadow-2xl">
                    <div className="flex justify-center pt-3 pb-1">
                      <div className="w-9 h-1 rounded-full bg-zinc-700" />
                    </div>
                    <div className="px-5 pb-6 pt-2 space-y-2">
                      <div className="text-sm font-bold text-white mb-3">What would you like to log?</div>
                      {[
                        { label: "Transplant", action: () => { setActiveSheet(null); setTransplantForm({ container: container || "Black Pot", date: today(), dateUnknown: false }); setShowTransplantModal(true); } },
                        { label: "Amendment",  action: () => { setActiveSheet(null); setAmendForm({ date: today(), amendment: "", notes: "" }); setAmendSearch(""); setShowAmendModal(true); } },
                        { label: "Clone Cut",  action: () => { setActiveSheet(null); setCloneForm({ date: today(), count: "", notes: "" }); setShowCloneModal(true); } },
                        { label: "Feeding",    action: () => { setActiveSheet(null); setFeedingForm({ date: today(), type: "Water Only", notes: "" }); setShowFeedingModal(true); } },
                        { label: "Reduction",  action: () => { setActiveSheet(null); setReductionForm({ date: today(), reason: "Space", notes: "" }); setShowReductionModal(true); } },
                      ].map(({ label, action }) => (
                        <button key={label} onClick={action} className="w-full text-left px-4 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl text-sm text-zinc-200 font-medium transition-colors">
                          {label}
                        </button>
                      ))}
                      <button onClick={() => setActiveSheet(null)} className="w-full py-2.5 mt-1 rounded-xl border border-zinc-700 text-zinc-500 text-sm font-semibold">Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {detailTab === "Photos" && (
          <PhotosTab
            mother={mother}
            onAddPhoto={onAddPhoto}
            onRemovePhoto={onRemovePhoto}
          />
        )}
      </Modal>

      {showTransplantModal && (
        <Modal title="Log Transplant" onClose={() => setShowTransplantModal(false)}>
          <div className="space-y-4">
            <FormField label="Container / Stage">
              <select className={selectCls} value={transplantForm.container} onChange={e => setTransplantForm(p => ({ ...p, container: e.target.value }))}>
                {CONTAINERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Date Transplanted">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setTransplantForm(p => ({ ...p, dateUnknown: !p.dateUnknown }))}
                  className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors w-full ${
                    transplantForm.dateUnknown
                      ? "bg-zinc-700 border-zinc-600 text-zinc-200"
                      : "bg-zinc-800 border-zinc-700 text-zinc-500"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${transplantForm.dateUnknown ? "bg-emerald-600 border-emerald-500" : "border-zinc-600"}`}>
                    {transplantForm.dateUnknown && <span className="text-white text-[10px]">✓</span>}
                  </span>
                  Date unknown
                </button>
                {!transplantForm.dateUnknown && (
                  <input type="date" className={inputCls} value={transplantForm.date} onChange={e => setTransplantForm(p => ({ ...p, date: e.target.value }))} />
                )}
              </div>
            </FormField>
            <button onClick={() => { onAddTransplant({ ...transplantForm, date: transplantForm.dateUnknown ? null : transplantForm.date }); setShowTransplantModal(false); }} className={btnPrimary}>Save Transplant</button>
          </div>
        </Modal>
      )}

      {showAmendModal && (
        <Modal title="Log Amendment" onClose={() => setShowAmendModal(false)}>
          <div className="space-y-4">
            <FormField label="Amendment">
              <input
                type="text"
                placeholder="Search or type amendment..."
                className={inputCls}
                value={amendSearch !== "" ? amendSearch : amendForm.amendment}
                onChange={e => { setAmendSearch(e.target.value); setAmendForm(p => ({ ...p, amendment: e.target.value })); }}
                onFocus={() => { if (!amendSearch) setAmendSearch(amendForm.amendment || ""); }}
              />
              {amendSearch && (
                <div className="mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                  {COMMON_AMENDMENTS.filter(a => a.toLowerCase().includes(amendSearch.toLowerCase())).map(a => (
                    <button key={a} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors" onClick={() => { setAmendForm(p => ({ ...p, amendment: a })); setAmendSearch(""); }}>
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </FormField>
            <FormField label="Date">
              <input type="date" className={inputCls} value={amendForm.date} onChange={e => setAmendForm(p => ({ ...p, date: e.target.value }))} />
            </FormField>
            <FormField label="Notes (optional)">
              <input type="text" placeholder="Amount, method, etc." className={inputCls} value={amendForm.notes} onChange={e => setAmendForm(p => ({ ...p, notes: e.target.value }))} />
            </FormField>
            <button onClick={() => { if (amendForm.amendment.trim()) { onAddAmendment(amendForm); setShowAmendModal(false); setAmendSearch(""); } }} className={btnPrimary} disabled={!amendForm.amendment.trim()}>
              Save Amendment
            </button>
          </div>
        </Modal>
      )}

      {showCloneModal && (
        <Modal title="Log Clone Cut" onClose={() => setShowCloneModal(false)}>
          <div className="space-y-4">
            <FormField label="Number of Clones Taken">
              <input type="number" min="1" placeholder="e.g. 12" className={inputCls} value={cloneForm.count} onChange={e => setCloneForm(p => ({ ...p, count: e.target.value }))} />
            </FormField>
            <FormField label="Date">
              <input type="date" className={inputCls} value={cloneForm.date} onChange={e => setCloneForm(p => ({ ...p, date: e.target.value }))} />
            </FormField>
            <FormField label="Notes (optional)">
              <input type="text" placeholder="Tray ID, destination, etc." className={inputCls} value={cloneForm.notes} onChange={e => setCloneForm(p => ({ ...p, notes: e.target.value }))} />
            </FormField>
            <button onClick={() => { if (cloneForm.count) { onAddCloneEntry(cloneForm); setShowCloneModal(false); } }} className={btnPrimary} disabled={!cloneForm.count}>
              Save Clone Log
            </button>
          </div>
        </Modal>
      )}

      {showFeedingModal && (
        <Modal title="Log Feeding" onClose={() => setShowFeedingModal(false)}>
          <div className="space-y-4">
            <FormField label="Feeding Type">
              <select className={selectCls} value={feedingForm.type} onChange={e => setFeedingForm(p => ({ ...p, type: e.target.value }))}>
                {FEEDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Date">
              <input type="date" className={inputCls} value={feedingForm.date} onChange={e => setFeedingForm(p => ({ ...p, date: e.target.value }))} />
            </FormField>
            <FormField label="Notes (optional)">
              <input type="text" placeholder="pH, EC, volume, observations..." className={inputCls} value={feedingForm.notes} onChange={e => setFeedingForm(p => ({ ...p, notes: e.target.value }))} />
            </FormField>
            <button onClick={() => { onAddFeedingEntry(feedingForm); setShowFeedingModal(false); }} className={btnPrimary}>
              Save Feeding
            </button>
          </div>
        </Modal>
      )}

      {showReductionModal && (
        <Modal title="Log Reduction" onClose={() => setShowReductionModal(false)}>
          <div className="space-y-4">
            <FormField label="Reason">
              <div className="flex gap-2 flex-wrap">
                {["Space", "Sidelined", "Launchpad Prep", "Other"].map(r => (
                  <button key={r} onClick={() => setReductionForm(p => ({ ...p, reason: r }))}
                    className={`flex-1 text-xs py-2 rounded-xl font-medium border transition-colors ${reductionForm.reason === r ? "bg-amber-900/50 text-amber-300 border-amber-700/40" : "bg-zinc-800 border-zinc-700 text-zinc-500"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Date">
              <input type="date" className={inputCls} value={reductionForm.date} onChange={e => setReductionForm(p => ({ ...p, date: e.target.value }))} />
            </FormField>
            <FormField label="Notes (optional)">
              <input type="text" placeholder="What was cut, how much, etc." className={inputCls} value={reductionForm.notes} onChange={e => setReductionForm(p => ({ ...p, notes: e.target.value }))} />
            </FormField>
            <button onClick={() => { onAddReductionEntry(reductionForm); setShowReductionModal(false); }} className={btnPrimary}>
              Save Reduction
            </button>
          </div>
        </Modal>
      )}

      {sendToCloneEntry && (
        <SendToCloneLogModal
          cloneEntry={sendToCloneEntry}
          strainName={s.name}
          strainCode={mother.strainCode}
          motherLocation={mother.location}
          onClose={() => setSendToCloneEntry(null)}
        />
      )}
    </>
  );
});

// ── Photos Tab ──────────────────────────────────────────────────────────────
function PhotosTab({ mother, onAddPhoto, onRemovePhoto }) {
  const photos = mother.photos || [];
  const fileInputRef = useRef(null);
  const [adding, setAdding] = useState(false);
  const [caption, setCaption] = useState("");
  const [photoDate, setPhotoDate] = useState(today());
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fullscreen, setFullscreen] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSavePhoto() {
    if (!selectedFile) return;
    setUploading(true);
    setStorageWarning(false);
    try {
      const dataUrl = await compressImage(selectedFile);
      onAddPhoto({ dataUrl, caption: caption.trim(), date: photoDate });
      setAdding(false);
      setCaption("");
      setPhotoDate(today());
      setPreviewUrl(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setStorageWarning(true);
    }
    setUploading(false);
  }

  function handleCancelAdd() {
    setAdding(false);
    setCaption("");
    setPhotoDate(today());
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      {storageWarning && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3">
          <div className="text-xs text-red-300 font-semibold">Storage Full</div>
          <div className="text-xs text-red-400/80 mt-0.5">Could not save photo. Delete some existing photos to free up space.</div>
        </div>
      )}

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className={btnPrimary}
        >
          + Add Photo
        </button>
      ) : (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 space-y-3">
          <div className="text-xs text-zinc-400 font-medium mb-1">New Photo</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="w-full border border-dashed border-zinc-600 hover:border-zinc-400 rounded-xl py-4 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {previewUrl ? "Change Photo" : "Tap to Select Photo"}
          </button>
          {previewUrl && (
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
          <input
            type="text"
            placeholder="Caption (optional)"
            className={inputCls}
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />
          <input
            type="date"
            className={inputCls}
            value={photoDate}
            onChange={e => setPhotoDate(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleCancelAdd} className={btnSecondary}>Cancel</button>
            <button
              onClick={handleSavePhoto}
              className={btnPrimary}
              disabled={!selectedFile || uploading}
            >
              {uploading ? "Saving..." : "Save Photo"}
            </button>
          </div>
        </div>
      )}

      {photos.length === 0 && !adding ? (
        <div className="text-center py-8 text-zinc-600 text-sm">No photos yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map(p => (
            <button
              key={p.id}
              onClick={() => setFullscreen(p)}
              className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors text-left"
            >
              <div className="w-full aspect-square">
                <img src={p.dataUrl} alt={p.caption || "Photo"} className="w-full h-full object-cover" />
              </div>
              {(p.caption || p.date) && (
                <div className="px-2 py-1.5">
                  {p.caption && <div className="text-[10px] text-zinc-300 truncate">{p.caption}</div>}
                  {p.date && <div className="text-[10px] text-zinc-600">{fmtDate(p.date)}</div>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {fullscreen && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center"
          onClick={() => setFullscreen(null)}
        >
          <div className="w-full max-w-md px-4 space-y-3" onClick={e => e.stopPropagation()}>
            <img src={fullscreen.dataUrl} alt={fullscreen.caption || "Photo"} className="w-full rounded-xl object-contain max-h-[65vh]" />
            {fullscreen.caption && <div className="text-sm text-zinc-200 text-center">{fullscreen.caption}</div>}
            {fullscreen.date && <div className="text-xs text-zinc-500 text-center">{fmtDate(fullscreen.date)}</div>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setFullscreen(null)}
                className={btnSecondary}
              >
                Close
              </button>
              <button
                onClick={() => { onRemovePhoto(fullscreen.id); setFullscreen(null); }}
                className="flex-1 bg-red-900/40 hover:bg-red-900/60 border border-red-800/50 text-red-400 font-medium text-sm rounded-xl py-2.5 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
