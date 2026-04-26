import { useState, useEffect, useRef, memo, useCallback, useMemo, lazy, Suspense } from "react";
import { loadFromDB, saveToDB, subscribeToKey } from "./supabase";
import { daysRemaining } from "./dry-room-utils";
import {
  STRAINS, getStrain,
  CONTAINERS, MOTHER_STATUSES, COMMON_AMENDMENTS, DETAIL_TABS, TYPE_META,
  uid, today, fmtDate, daysSince,
  currentContainer, currentTransplantDate,
  HEALTH_COLOR_THRESHOLDS, HEALTH_BG_THRESHOLDS, HEALTH_LABELS, HEALTH_BADGE_CLASSES,
  healthColor, healthBg, healthLabel,
  daysInVeg, vegDaysColor,
  statusBadgeColor, cardAccentColor,
  inputCls, selectCls, btnPrimary, btnSecondary,
  Badge, Modal, StatBox, SectionLabel, FormField, HealthDots, ContainerBadge,
  compressImage,
} from "./shared";
import RoomTab from "./RoomTab";
import FacilityTab from "./FacilityTab";
import { DEFAULT_FACILITY } from "./FacilityTab";
const ClonesTab        = lazy(() => import("./ClonesTab"));
const StatsTab         = lazy(() => import("./StatsTab"));
const DryRoomTab       = lazy(() => import("./DryRoomTab"));
const MotherDetailModal = lazy(() => import("./MotherDetail"));
import {
  LayoutDashboard, Leaf, Grid3X3, Plus, Download,
  Wifi, Loader2, AlertCircle,
  ChevronDown, ClipboardList,
  Scissors, BarChart2, Wind, Minus,
} from "lucide-react";

// ── Storage ────────────────────────────────────────────────────────────────
function load(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// Tab bar items — static, hoisted to module scope to avoid per-render allocation
const TAB_ITEMS = [
  { key: "Summary",  label: "Summary",  icon: LayoutDashboard },
  { key: "Mothers",  label: "Mothers",  icon: Leaf },
  { key: "Room",     label: "Room",     icon: Grid3X3 },
  { key: "Facility", label: "Facility", icon: ClipboardList },
  { key: "Stats",    label: "Stats",    icon: BarChart2 },
  { key: "DryRoom",  label: "Dry Room", icon: Wind },
  { key: "Clones",   label: "Clones",   icon: Scissors },
];

// Normalize Supabase timestamp strings before echo-filter comparison.
// Supabase may return "2024-03-26 10:30:00+00" while we store "2024-03-26T10:30:00.000Z".
function normTs(ts) { try { return ts ? new Date(ts).toISOString() : null; } catch { return ts; } }

function defaultMother() {
  return {
    id: uid(),
    strainCode: "",
    status: "Active",
    location: "",
    healthLevel: 4,
    healthLog: [],
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
  const mothersSaveTimerRef = useRef(null);
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
    // Debounce: batch rapid successive mutations (e.g. quick-log water then clone)
    // into a single Supabase write instead of one write per action.
    clearTimeout(mothersSaveTimerRef.current);
    setSyncStatus("syncing");
    mothersSaveTimerRef.current = setTimeout(() => {
      const ts = new Date().toISOString();
      pendingTimestampsRef.current.add(ts);
      saveToDB("mothers_v1", mothers, ts)
        .then(() => setSyncStatus("live"))
        .catch((err) => { console.error("[supabase] mothers save failed:", err); setSyncStatus("error"); })
        .finally(() => { setTimeout(() => pendingTimestampsRef.current.delete(ts), 3000); });
    }, 600);
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
    setMothers(prev => prev.map(m => {
      if (m.id !== id) return m;
      let finalPatch = patch;
      if (patch.healthLevel !== undefined && patch.healthLevel !== m.healthLevel) {
        finalPatch = {
          ...patch,
          healthLog: [...(m.healthLog ?? []), { date: today(), level: patch.healthLevel }],
        };
      }
      return { ...m, ...finalPatch };
    }));
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

  const updateCloneOutcome = useCallback((motherId, entryId, outcome) => {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, cloneLog: m.cloneLog.map(c => c.id === entryId ? { ...c, outcome } : c) }
        : m
    ));
  }, []);

  const active = useMemo(() => mothers.filter(m => m.status === "Active"), [mothers]);
  const sidelined = useMemo(() => mothers.filter(m => m.status === "Sidelined"), [mothers]);

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
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#2a1f00] border border-[#3a2e00] flex items-center justify-center shadow-lg shadow-amber-950/50">
          <Leaf className="w-8 h-8 text-amber-400" strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-[#f5f5f0] font-bold text-xl tracking-tight text-center">Mother Log</div>
          <div className="text-amber-700 text-[11px] font-semibold tracking-widest uppercase text-center mt-0.5">Stacks Family Farms</div>
        </div>
        <Loader2 className="w-4 h-4 text-amber-700 animate-spin mt-2" />
      </div>
    );
  }

  const SyncIcon = syncStatus === "syncing" ? Loader2
    : syncStatus === "error" ? AlertCircle
    : Wifi;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#c5b08a] max-w-md mx-auto flex flex-col pb-4">
      {/* ── Header ── */}
      <div className="px-4 pt-safe pb-3 border-b border-[#2a2418]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2a1f00] border border-[#3a2e00] flex items-center justify-center flex-shrink-0">
              <Leaf className="w-[18px] h-[18px] text-amber-400" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-[#f5f5f0] font-bold text-base leading-tight tracking-tight">Mother Log</h1>
              <div className="flex items-center gap-1.5">
                <p className="text-amber-700 text-[10px] font-semibold tracking-widest uppercase">Stacks Family Farms</p>
                <SyncIcon
                  title={syncStatus === "syncing" ? "Saving…" : syncStatus === "error" ? "Sync error" : "Live"}
                  className={`w-2.5 h-2.5 flex-shrink-0 ${
                    syncStatus === "syncing" ? "text-yellow-400 animate-spin" :
                    syncStatus === "error"   ? "text-red-500" :
                                              "text-amber-600"
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
              aria-label="Export CSV"
              className="w-11 h-11 flex items-center justify-center rounded-xl border border-[#2a2418] text-[#6a5a3a] active:text-[#f5f5f0] active:bg-[#1a1a1a] transition-colors"
            >
              <Download className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              onClick={openAddForm}
              className="h-11 px-4 flex items-center gap-1.5 bg-amber-600 active:bg-amber-700 text-[#0a0a0a] text-sm font-semibold rounded-xl transition-colors shadow-md shadow-amber-950/60"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex gap-0.5 bg-[#111111] border border-[#2a2418] rounded-2xl p-1">
          {TAB_ITEMS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => { if (key === "Add") { openAddForm(); } else { setTab(key); } }}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all duration-150 min-h-[52px] justify-center ${
                  active
                    ? "bg-[#2a1f00] text-amber-300 border border-[#3a2e00] shadow-sm"
                    : "text-[#6a5a3a] active:text-[#c5b08a] active:bg-[#1a1a1a]"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] ${active ? "text-amber-400" : "text-[#6a5a3a]"}`} strokeWidth={active ? 2 : 1.75} />
                <span className={`text-[10px] font-semibold tracking-wide ${active ? "text-amber-300" : "text-[#6a5a3a]"}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab !== "Clones" && tab !== "Stats" && tab !== "DryRoom" && (
        <div className="px-4 flex-1">
          {tab === "Summary" && (
            <SummaryTab
              mothers={mothers}
              active={active}
              sidelined={sidelined}
              onSelectMother={handleSelectMother}
            />
          )}
          {tab === "Mothers" && (
            <MothersTab
              mothers={mothers}
              onSelectMother={handleSelectMother}
              onQuickTransplant={(mid, container) => addTransplant(mid, { container, date: today() })}
              onQuickAmend={(mid, amendment, notes) => addAmendment(mid, { date: today(), amendment, notes })}
              onQuickClone={(mid, count, notes) => addCloneEntry(mid, { date: today(), count, notes })}
              onQuickReduction={(mid, reason, notes) => addReductionEntry(mid, { date: today(), reason, notes })}
            />
          )}
          {tab === "Room" && (
            <RoomTab
              mothers={mothers}
              roomSpots={roomSpots}
              setRoomSpots={setRoomSpots}
              onSelectMother={handleSelectMother}
              onUpdateMother={updateMother}
              onAddAmendment={addAmendment}
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
      )}
      <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 text-amber-600 animate-spin" /></div>}>
        {tab === "Stats"   && <StatsTab mothers={mothers} getStrain={getStrain} />}
        {tab === "DryRoom" && <DryRoomTab />}
        {tab === "Clones"  && <ClonesTab />}
      </Suspense>

      {detailMotherId && (() => {
        const detailMother = mothers.find(m => m.id === detailMotherId) ?? null;
        if (!detailMother) return null;
        return (
          <Suspense fallback={null}>
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
              onAddReductionEntry={(entry) => addReductionEntry(detailMother.id, entry)}
              onRemoveReductionEntry={(eid) => removeReductionEntry(detailMother.id, eid)}
              onAddPhoto={(photo) => addPhoto(detailMother.id, photo)}
              onRemovePhoto={(photoId) => removePhoto(detailMother.id, photoId)}
              onUpdateCloneOutcome={(entryId, outcome) => updateCloneOutcome(detailMother.id, entryId, outcome)}
            />
          </Suspense>
        );
      })()}
    </div>
  );
}

// ── Summary Tab ────────────────────────────────────────────────────────────
const DR_DEFAULT = { active: [], bins: [] };

const SummaryTab = memo(function SummaryTab({ mothers, active, sidelined, onSelectMother }) {
  const [strainExpanded, setStrainExpanded] = useState(false);

  // ── Pipeline snapshot (dry room + clones) ──────────────────────────────
  const [drData, setDrData] = useState(DR_DEFAULT);
  const [clonePlants, setClonePlants] = useState([]);

  useEffect(() => {
    loadFromDB("dryroom").then(d => { if (d) setDrData({ ...DR_DEFAULT, ...d }); });
    loadFromDB("clone_plants_v1").then(p => { if (p) setClonePlants(p); });
    const unsubDr = subscribeToKey("dryroom", (d) => { if (d) setDrData({ ...DR_DEFAULT, ...d }); });
    const unsubCl = subscribeToKey("clone_plants_v1", (p) => { if (p) setClonePlants(p); });
    return () => { unsubDr.unsubscribe(); unsubCl.unsubscribe(); };
  }, []);

  const hangingCount  = drData.active.length;
  const overdueCount  = drData.active.filter(b => daysRemaining(b.dateHung) <= 0).length;
  const activeBins    = drData.bins.filter(b => !b.harvestId).length;
  const propagating   = clonePlants.filter(p => !p.archived && p.status === "Cloned").length;
  const rooted        = clonePlants.filter(p => !p.archived && p.status === "Transplanted").length;

  const vegOverdue = mothers.filter(m => m.status === "Active" && daysInVeg(m) >= 30);

  const strainCounts = mothers.reduce((acc, m) => {
    const s = getStrain(m.strainCode);
    const key = `${s.code} – ${s.name}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byHealth = useMemo(
    () => [5, 4, 3, 2, 1].map(h => ({ h, cnt: mothers.filter(m => m.healthLevel === h).length })).filter(x => x.cnt > 0),
    [mothers]
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Total Mothers" value={mothers.length} colorClass="text-[#f5f5f0]" />
        <StatBox label="Active" value={active.length} colorClass="text-emerald-400" />
        <StatBox label="Sidelined" value={sidelined.length} colorClass="text-[#6a5a3a]" />
        <StatBox label="Strains" value={new Set(mothers.map(m => m.strainCode)).size} colorClass="text-violet-400" />
      </div>

      {(hangingCount > 0 || activeBins > 0 || propagating > 0 || rooted > 0) && (
        <div>
          <SectionLabel>Pipeline</SectionLabel>
          <div className="bg-[#111111] border border-[#2a2418] rounded-2xl overflow-hidden divide-y divide-[#2a2418]">
            {hangingCount > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[#c5b08a]">Hanging</span>
                <div className="flex items-center gap-2">
                  {overdueCount > 0 && <span className="text-[10px] text-red-400 font-semibold">{overdueCount} overdue</span>}
                  <span className="text-xs font-semibold text-[#f5f5f0]">{hangingCount} batch{hangingCount !== 1 ? "es" : ""}</span>
                </div>
              </div>
            )}
            {activeBins > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[#c5b08a]">Curing / Burping</span>
                <span className="text-xs font-semibold text-[#f5f5f0]">{activeBins} bin{activeBins !== 1 ? "s" : ""}</span>
              </div>
            )}
            {propagating > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[#c5b08a]">Propagating</span>
                <span className="text-xs font-semibold text-[#f5f5f0]">{propagating} plant{propagating !== 1 ? "s" : ""}</span>
              </div>
            )}
            {rooted > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[#c5b08a]">Rooted / Ready</span>
                <span className="text-xs font-semibold text-emerald-400">{rooted} plant{rooted !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {byHealth.length > 0 && (
        <div>
          <SectionLabel>Health Breakdown</SectionLabel>
          <div className="bg-[#111111] border border-[#2a2418] rounded-2xl overflow-hidden">
            {byHealth.map(({ h, cnt }) => (
              <div key={h} className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2418] last:border-0">
                <span className="text-xs text-[#c5b08a]">{HEALTH_LABELS[h]}</span>
                <Badge label={cnt} colorClass={HEALTH_BADGE_CLASSES[h]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(strainCounts).length > 0 && (
        <div>
          <SectionLabel>By Strain</SectionLabel>
          <div className="bg-[#111111] border border-[#2a2418] rounded-2xl overflow-hidden">
            {Object.entries(strainCounts).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => (
              <div key={name} className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2418] last:border-0">
                <span className="text-xs text-[#c5b08a]">{name}</span>
                <span className="text-xs text-[#6a5a3a]">{cnt}</span>
              </div>
            ))}
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
                <button key={m.id} onClick={() => onSelectMother(m)} className="press-card w-full bg-[#111111] border border-red-900/50 rounded-2xl px-4 py-3.5 text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-red-400 font-medium">{s.code} – {s.name}</div>
                      {m.location && <div className="text-xs text-[#6a5a3a] mt-0.5">{m.location}</div>}
                    </div>
                    <span className="text-red-400 text-sm font-bold">{daysInVeg(m)}d</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sidelined.length > 0 && (
        <div>
          <SectionLabel>Sidelined</SectionLabel>
          <div className="space-y-2">
            {sidelined.map(m => {
              const s = getStrain(m.strainCode);
              return (
                <button key={m.id} onClick={() => onSelectMother(m)} className="press-card w-full bg-[#111111] border border-[#2a2418] rounded-2xl px-4 py-3.5 text-left">
                  <div className="text-sm text-[#c5b08a] font-medium">{s.code} – {s.name}</div>
                  {m.location && <div className="text-xs text-[#6a5a3a] mt-0.5">{m.location}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mothers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 px-2">
          <div className="bg-[#111111] border border-[#2a2418] rounded-2xl p-8 w-full text-center space-y-4">
            <div className="text-4xl mb-2">🌿</div>
            <div className="text-[#f5f5f0] font-semibold text-base">No mother plants yet</div>
            <div className="text-[#6a5a3a] text-sm leading-relaxed">
              Tap <span className="text-amber-400 font-medium">+ Add Mother</span> to get started
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2418] rounded-xl p-4 text-left space-y-2 mt-2">
              <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider mb-2">What you can track</div>
              <div className="flex items-start gap-2 text-xs text-[#c5b08a]">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Health level, status, and VEG room location</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-[#c5b08a]">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Container transplant history</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-[#c5b08a]">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Amendment log with dates</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-[#c5b08a]">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Clone cuts — send directly to Clone Log</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Strain Analytics (Feature F) ── */}
      {mothers.length > 0 && (() => {
        const strainMap = new Map();
        for (const m of mothers) {
          const code = m.strainCode;
          if (!strainMap.has(code)) strainMap.set(code, []);
          strainMap.get(code).push(m);
        }
        const strainStats = [...strainMap.entries()].map(([code, moms]) => {
          const s = getStrain(code);
          const totalMothers = moms.length;
          const avgHealth = moms.length ? (moms.reduce((a, m) => a + (m.healthLevel || 0), 0) / moms.length).toFixed(1) : "—";
          const avgHealthNum = moms.length ? moms.reduce((a, m) => a + (m.healthLevel || 0), 0) / moms.length : 0;
          const totalCloneCount = moms.reduce((a, m) => a + (m.cloneLog || []).reduce((x, c) => x + (parseInt(c.count) || 0), 0), 0);
          const allClones = moms.flatMap(m => m.cloneLog || []);
          const rootedClones = allClones.filter(c => c.outcome === "rooted").reduce((a, c) => a + (parseInt(c.count) || 0), 0);
          const totalResolvedClones = allClones.filter(c => c.outcome === "rooted" || c.outcome === "failed").reduce((a, c) => a + (parseInt(c.count) || 0), 0);
          const rootRate = totalResolvedClones > 0 ? Math.round((rootedClones / totalResolvedClones) * 100) : null;
          const allFeedings = moms.flatMap(m => m.feedingLog || []);
          const lastFedDates = allFeedings.map(f => f.date).filter(Boolean);
          const lastFed = lastFedDates.length ? lastFedDates.sort().at(-1) : null;
          return { code, name: s.name, totalMothers, avgHealth, avgHealthNum, totalCloneCount, rootRate, lastFed };
        }).sort((a, b) => b.totalMothers - a.totalMothers);

        return (
          <div>
            <button
              onClick={() => setStrainExpanded(p => !p)}
              className="w-full flex items-center justify-between py-2 min-h-[44px]"
            >
              <SectionLabel>Strain Analytics</SectionLabel>
              <ChevronDown className={`w-4 h-4 text-[#6a5a3a] transition-transform duration-200 mb-2 ${strainExpanded ? "rotate-180" : ""}`} strokeWidth={2} />
            </button>
            {strainExpanded && (
              <div className="space-y-2">
                {strainStats.map(st => {
                  const healthCls = st.avgHealthNum > 3 ? "text-emerald-400" : st.avgHealthNum === 3 ? "text-yellow-400" : "text-red-400";
                  return (
                    <div key={st.code} className="bg-[#111111] border border-[#2a2418] rounded-2xl px-4 py-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#f5f5f0]">{st.code}</span>
                        <span className="text-xs text-[#c5b08a] truncate">{st.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] text-[#6a5a3a]">{st.totalMothers} mother{st.totalMothers !== 1 ? "s" : ""}</span>
                        <span className={`text-[10px] font-semibold ${healthCls}`}>health {st.avgHealth}</span>
                        <span className="text-[10px] text-[#6a5a3a]">{st.totalCloneCount} clones</span>
                        {st.rootRate !== null && (
                          <span className={`text-[10px] font-semibold ${st.rootRate >= 70 ? "text-emerald-400" : st.rootRate >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                            {st.rootRate}% root rate
                          </span>
                        )}
                        {st.lastFed && <span className="text-[10px] text-[#6a5a3a]">fed {fmtDate(st.lastFed)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
});

// ── Mothers Tab ────────────────────────────────────────────────────────────
const MotherCard = memo(function MotherCard({ m, isOpen, onSwipeOpen, onSwipeClose, onOpenQuickLog, onOpenAmend, onOpenClone }) {
  const showClone = m.status !== "Sidelined";
  const ACTION_W = showClone ? 96 : 48;
  const touchStartX = useRef(null);
  const swipeDidFire = useRef(false);

  const s = getStrain(m.strainCode);
  const container = currentContainer(m);
  const txDate = currentTransplantDate(m);
  const days = daysSince(txDate);
  const totalClones = (m.cloneLog || []).reduce((a, c) => a + (parseInt(c.count) || 0), 0);
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
          aria-label="Log amendment"
          onClick={() => { onSwipeClose(); onOpenAmend(m.id); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-violet-900 active:bg-violet-800 transition-colors"
        >
          <span className="text-base leading-none">🌿</span>
          <span className="text-[11px] font-semibold text-violet-300 leading-none">Amend</span>
        </button>
        {showClone && (
          <button
            aria-label="Log clone cut"
            onClick={() => { onSwipeClose(); onOpenClone(m.id); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-amber-900 active:bg-amber-800 transition-colors"
          >
            <span className="text-base leading-none">✂️</span>
            <span className="text-[11px] font-semibold text-amber-300 leading-none">Clone</span>
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
        className={`press-card w-full bg-[#111111] border border-[#2a2418] border-l-2 ${cardAccentColor(m)} rounded-2xl px-4 py-3.5 text-left cursor-pointer select-none`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-[#f5f5f0]">{s.code}</span>
              <Badge label={m.status} colorClass={statusBadgeColor(m.status)} />
            </div>
            <div className="text-xs text-[#c5b08a] mt-0.5 truncate">{s.name}</div>
            {m.location && <div className="text-[10px] text-[#6a5a3a] mt-0.5">{m.location}</div>}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <HealthDots level={m.healthLevel} />
            {container && <ContainerBadge container={container} />}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          {container && <span className="text-[10px] text-[#6a5a3a]">{txDate ? `${days}d in container` : "Date unknown"}</span>}
          {totalClones > 0 && <span className="text-[10px] text-[#6a5a3a]">{totalClones} clones</span>}
          <span className={`text-[10px] font-medium ${m.status === "Active" ? vegDaysColor(vegDays) : "text-[#6a5a3a]"}`}>{vegDays}d veg{m.status === "Active" && vegDays >= 25 ? " ⚠" : ""}</span>
        </div>
      </div>
    </div>
  );
});

// ── Strain Group (collapsible) ──────────────────────────────────────────────
const StrainGroup = memo(function StrainGroup({
  group, isCollapsed, onToggle,
  swipedId, onSwipeOpen, onSwipeClose,
  onOpenQuickLog, onOpenAmend, onOpenClone,
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
          onOpenAmend={onOpenAmend}
          onOpenClone={onOpenClone}
        />
      ))}
    </div>
  );


  return (
    <div className="mb-1">
      <button
        onClick={() => onToggle(group.code)}
        className="w-full flex items-center gap-2 py-2 px-0.5 min-h-[44px]"
      >
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="w-0.5 h-4 rounded-full bg-[#2a2418] flex-shrink-0" />
          <span className="text-xs font-bold text-[#c5b08a] truncate">{group.name}</span>
          <span className="text-[10px] font-semibold bg-[#2a1f00] text-amber-500 border border-[#3a2e00] rounded-full px-1.5 py-0.5 flex-shrink-0">
            {group.mothers.length}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#6a5a3a] flex-shrink-0 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}
          strokeWidth={2.5}
        />
      </button>
      {!isCollapsed && cards}
    </div>
  );
});

function MothersTab({ mothers, onSelectMother, onQuickTransplant, onQuickAmend, onQuickClone, onQuickReduction }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [swipedId, setSwipedId] = useState(null);
  const [quickSheet, setQuickSheet] = useState(null); // null | { type: 'transplant'|'amend'|'clone'|'reduction', motherId }
  const [transplantInput, setTransplantInput] = useState({ container: "Black Pot" });
  const [amendInput, setAmendInput] = useState({ amendment: "", notes: "", search: "" });
  const [cloneInput, setCloneInput] = useState({ count: "", notes: "" });
  const [reductionInput, setReductionInput] = useState({ reason: "Space", notes: "" });
  const [collapsed, setCollapsed] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [quickLogSheet, setQuickLogSheet] = useState(null); // null | { motherId }

  const filtered = useMemo(() => mothers
    .filter(m => {
      if (filter === "All") return true;
      if (filter === "Active" || filter === "Sidelined") return m.status === filter;
      if (filter === "Veg Overdue") return m.status === "Active" && daysInVeg(m) >= 30;
      return true;
    })
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
  const handleOpenTransplant = useCallback((mid, currentCont) => { setTransplantInput({ container: currentCont || "Black Pot" }); setQuickSheet({ type: "transplant", motherId: mid }); }, []);
  const handleOpenAmend = useCallback((mid) => setQuickSheet({ type: "amend", motherId: mid }), []);
  const handleOpenClone = useCallback((mid) => setQuickSheet({ type: "clone", motherId: mid }), []);
  const handleOpenReduction = useCallback((mid) => { setReductionInput({ reason: "Space", notes: "" }); setQuickSheet({ type: "reduction", motherId: mid }); }, []);
  const handleOpenQuickLog = useCallback((mid) => { setSwipedId(null); setQuickLogSheet({ motherId: mid }); }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function closeSheet() {
    setQuickSheet(null);
    setQuickLogSheet(null);
    setTransplantInput({ container: "Black Pot" });
    setAmendInput({ amendment: "", notes: "", search: "" });
    setCloneInput({ count: "", notes: "" });
    setReductionInput({ reason: "Space", notes: "" });
  }

  function handleTransplantConfirm() {
    onQuickTransplant(quickSheet.motherId, transplantInput.container);
    closeSheet();
    showToast("Transplanted");
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

  function handleReductionConfirm() {
    onQuickReduction(quickSheet.motherId, reductionInput.reason, reductionInput.notes.trim());
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
        {["All", "Active", "Sidelined", "Veg Overdue"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`${f.length > 10 ? "text-[10px]" : "text-xs"} px-3 py-1.5 rounded-xl font-semibold transition-colors min-h-[44px] flex items-center ${filter === f ? "bg-[#2a2418] text-[#f5f5f0]" : "bg-[#111111] border border-[#2a2418] text-[#6a5a3a] active:text-[#f5f5f0]"}`}>
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        mothers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-2">
            <div className="bg-[#111111] border border-[#2a2418] rounded-2xl p-8 w-full text-center space-y-3">
              <div className="text-4xl mb-2">🌿</div>
              <div className="text-[#f5f5f0] font-semibold text-base">No mother plants yet</div>
              <div className="text-[#6a5a3a] text-sm">
                Tap the green <span className="text-amber-400 font-medium">Add</span> button in the top right to get started
              </div>
              <div className="text-[#6a5a3a] text-xs mt-2">
                Track health, containers, amendments, and clone cuts all in one place.
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-[#6a5a3a] text-sm">No results.</div>
        )
      ) : (
        <div>
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
              onOpenAmend={handleOpenAmend}
              onOpenClone={handleOpenClone}
            />
          ))}
        </div>
      )}

      {/* Quick-log hub sheet — tap a card to open */}
      {quickLogSheet && (() => {
        const m = mothers.find(mo => mo.id === quickLogSheet.motherId);
        if (!m) return null;
        const s = getStrain(m.strainCode);
        const isSidelined = m.status === "Sidelined";
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setQuickLogSheet(null); }}>
            <div className="bg-[#0f0f0f] border border-[#2a2418] rounded-t-3xl w-full max-w-md shadow-2xl">
              <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-[#2a2418]" /></div>
              <div className="px-5 pb-6 pt-2 space-y-4">
                <div>
                  <div className="text-sm font-bold text-[#f5f5f0]">{s.code} — {s.name}</div>
                  {m.location && <div className="text-[10px] text-[#6a5a3a] mt-0.5">{m.location}</div>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setQuickLogSheet(null); handleOpenTransplant(m.id, currentContainer(m)); }}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-sky-900/50 border border-sky-800/40 active:bg-sky-800/60 transition-colors min-h-[80px]"
                  >
                    <span className="text-xl leading-none">🪴</span>
                    <span className="text-xs font-semibold text-sky-300">Transplant</span>
                  </button>
                  <button
                    disabled={isSidelined}
                    onClick={() => { setQuickLogSheet(null); handleOpenClone(m.id); }}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-amber-900/50 border border-amber-800/40 active:bg-amber-800/60 disabled:opacity-40 transition-colors min-h-[80px]"
                  >
                    <span className="text-xl leading-none">✂️</span>
                    <span className="text-xs font-semibold text-amber-300">Clone</span>
                  </button>
                  <button
                    onClick={() => { setQuickLogSheet(null); handleOpenReduction(m.id); }}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-red-900/50 border border-red-800/40 active:bg-red-800/60 transition-colors min-h-[80px]"
                  >
                    <span className="text-xl leading-none">−</span>
                    <span className="text-xs font-semibold text-red-300">Reduce</span>
                  </button>
                  <button
                    onClick={() => { setQuickLogSheet(null); handleOpenAmend(m.id); }}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-violet-900/50 border border-violet-800/40 active:bg-violet-800/60 transition-colors min-h-[80px]"
                  >
                    <span className="text-xl leading-none">🌿</span>
                    <span className="text-xs font-semibold text-violet-300">Amendment</span>
                  </button>
                </div>
                <button
                  onClick={() => { setQuickLogSheet(null); onSelectMother(m); }}
                  className="w-full py-3 rounded-2xl border border-[#2a2418] text-[#c5b08a] text-sm font-semibold active:bg-[#1a1a1a] active:text-[#f5f5f0] transition-colors min-h-[44px]"
                >
                  View Details →
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quick-log bottom sheets */}
      {quickSheet?.type === "amend" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) closeSheet(); }}>
          <div className="bg-[#0f0f0f] border border-[#2a2418] rounded-t-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-[#2a2418]" />
            </div>
            <div className="px-5 pb-6 pt-2 space-y-3">
              <div className="text-sm font-bold text-[#f5f5f0]">Quick Amend</div>
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
                  <div className="mt-1 bg-[#1a1a1a] border border-[#2a2418] rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                    {COMMON_AMENDMENTS.filter(a => a.toLowerCase().includes(amendInput.search.toLowerCase())).map(a => (
                      <button key={a} className="w-full text-left px-3 py-2 text-xs text-[#c5b08a] hover:bg-[#1a1a1a] active:bg-[#1a1a1a] transition-colors" onClick={() => setAmendInput(p => ({ ...p, amendment: a, search: "" }))}>
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
                <button onClick={closeSheet} className="flex-1 py-2.5 rounded-xl border border-[#2a2418] text-[#6a5a3a] text-sm font-semibold min-h-[44px] active:bg-[#1a1a1a] active:text-[#c5b08a] transition-colors">Cancel</button>
                <button
                  onClick={handleAmendConfirm}
                  disabled={!amendInput.amendment.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-violet-700 text-[#f5f5f0] text-sm font-semibold disabled:opacity-40 active:bg-violet-600 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {quickSheet?.type === "transplant" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) closeSheet(); }}>
          <div className="bg-[#0f0f0f] border border-[#2a2418] rounded-t-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 rounded-full bg-[#2a2418]" /></div>
            <div className="px-5 pb-6 pt-2 space-y-3">
              <div className="text-sm font-bold text-[#f5f5f0]">Quick Transplant</div>
              <div className="flex gap-2 flex-wrap">
                {CONTAINERS.map(c => (
                  <button
                    key={c}
                    onClick={() => setTransplantInput({ container: c })}
                    className={`flex-1 text-xs py-2 rounded-xl font-medium border transition-colors ${transplantInput.container === c ? "bg-sky-900/50 text-sky-300 border-sky-700/40" : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={closeSheet} className="flex-1 py-2.5 rounded-xl border border-[#2a2418] text-[#6a5a3a] text-sm font-semibold min-h-[44px] active:bg-[#1a1a1a] active:text-[#c5b08a] transition-colors">Cancel</button>
                <button onClick={handleTransplantConfirm} className="flex-1 py-2.5 rounded-xl bg-sky-700 text-[#f5f5f0] text-sm font-semibold active:bg-sky-600 transition-colors">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {quickSheet?.type === "clone" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) closeSheet(); }}>
          <div className="bg-[#0f0f0f] border border-[#2a2418] rounded-t-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-[#2a2418]" />
            </div>
            <div className="px-5 pb-6 pt-2 space-y-3">
              <div className="text-sm font-bold text-[#f5f5f0]">Quick Clone</div>
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
                <button onClick={closeSheet} className="flex-1 py-2.5 rounded-xl border border-[#2a2418] text-[#6a5a3a] text-sm font-semibold min-h-[44px] active:bg-[#1a1a1a] active:text-[#c5b08a] transition-colors">Cancel</button>
                <button
                  onClick={handleCloneConfirm}
                  disabled={!cloneInput.count || parseInt(cloneInput.count) < 1}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 text-[#0a0a0a] text-sm font-semibold disabled:opacity-40 active:bg-[#2a2418] transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {quickSheet?.type === "reduction" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) closeSheet(); }}>
          <div className="bg-[#0f0f0f] border border-[#2a2418] rounded-t-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-[#2a2418]" />
            </div>
            <div className="px-5 pb-6 pt-2 space-y-3">
              <div className="text-sm font-bold text-[#f5f5f0]">Log Reduction</div>
              <div className="flex gap-2 flex-wrap">
                {["Space", "Sidelined", "Launchpad Prep", "Other"].map(r => (
                  <button
                    key={r}
                    onClick={() => setReductionInput(p => ({ ...p, reason: r }))}
                    className={`flex-1 text-xs py-2 rounded-xl font-medium border transition-colors ${reductionInput.reason === r ? "bg-amber-900/50 text-amber-300 border-amber-700/40" : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Notes (optional)"
                className={inputCls}
                value={reductionInput.notes}
                onChange={e => setReductionInput(p => ({ ...p, notes: e.target.value }))}
                autoFocus
              />
              <div className="flex gap-2 pt-1">
                <button onClick={closeSheet} className="flex-1 py-2.5 rounded-xl border border-[#2a2418] text-[#6a5a3a] text-sm font-semibold min-h-[44px] active:bg-[#1a1a1a] active:text-[#c5b08a] transition-colors">Cancel</button>
                <button
                  onClick={handleReductionConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-red-800 text-[#f5f5f0] text-sm font-semibold active:bg-red-700 transition-colors"
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

// RoomTab and FacilityTab are now in their own files (RoomTab.jsx / FacilityTab.jsx)

// ── Add Mother Tab ─────────────────────────────────────────────────────────
function AddMotherTab({ form, setForm, onSubmit, onCancel }) {
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h2 className="text-[#f5f5f0] font-semibold text-sm">Add Mother Plant</h2>
        <p className="text-[#6a5a3a] text-xs mt-0.5">Fill in the details below</p>
      </div>
      <FormField label="Strain">
        <select className={selectCls} value={form.strainCode} onChange={e => f("strainCode", e.target.value)}>
          {STRAINS.map(s => <option key={s.code} value={s.code}>{s.code} – {s.name}</option>)}
        </select>
      </FormField>
      <FormField label="Status">
        <div className="flex gap-2">
          {MOTHER_STATUSES.map(s => (
            <button key={s} onClick={() => f("status", s)} className={`flex-1 text-xs py-2 rounded-xl font-bold border transition-colors min-h-[44px] flex items-center justify-center ${
              form.status === s
                ? s === "Active"
                  ? "bg-emerald-800/60 text-emerald-200 border-emerald-600"
                  : "bg-[#2a2418] text-[#f5f5f0] border-[#6a5a3a]"
                : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"
            }`}>
              {s}
            </button>
          ))}
        </div>
      </FormField>
      <FormField label={`Health Level — ${healthLabel(form.healthLevel)}`}>
        <div className="flex gap-2 items-center">
          {[1, 2, 3, 4, 5].map(i => (
            <button key={i} onClick={() => f("healthLevel", i)} className={`flex-1 h-11 rounded-xl border font-bold text-sm transition-colors ${form.healthLevel === i ? i <= 2 ? "bg-red-900/60 border-red-700 text-red-300" : i === 3 ? "bg-yellow-900/60 border-yellow-700 text-yellow-300" : "bg-emerald-900/60 border-emerald-700 text-emerald-300" : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"}`}>
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
                ? "bg-[#2a2418] border-[#6a5a3a] text-[#f5f5f0]"
                : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"
            }`}
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${form.initialDateUnknown ? "bg-amber-600 border-amber-500" : "border-[#2a2418]"}`}>
              {form.initialDateUnknown && <span className="text-[#f5f5f0] text-[10px]">✓</span>}
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

