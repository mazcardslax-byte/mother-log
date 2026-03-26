import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";

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

// ── Health helpers ─────────────────────────────────────────────────────────
function healthColor(level) {
  if (level <= 2) return "text-red-400";
  if (level === 3) return "text-yellow-400";
  return "text-emerald-400";
}
function healthBg(level) {
  if (level <= 2) return "bg-red-900/40 border-red-700/40 text-red-300";
  if (level === 3) return "bg-yellow-900/40 border-yellow-700/40 text-yellow-300";
  return "bg-emerald-900/40 border-emerald-700/40 text-emerald-300";
}
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

function feedingDaysColor(days) {
  if (days === null) return "text-zinc-500";
  if (days <= 2) return "text-emerald-400";
  if (days <= 4) return "text-yellow-400";
  return "text-red-400";
}

function statusBadgeColor(status) {
  if (status === "Active") return "bg-emerald-900/50 text-emerald-300 border-emerald-700/40";
  if (status === "Sidelined") return "bg-zinc-800 text-zinc-500 border-zinc-700";
  return "bg-zinc-800 text-zinc-500 border-zinc-700";
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl w-full max-w-md shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <span className="text-white font-semibold text-sm">{title}</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg">✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value, colorClass, sub }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{label}</div>
      {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">{children}</div>;
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
    photos: [],
    createdAt: today(),
  };
}

// ── QR Label ───────────────────────────────────────────────────────────────
async function printMotherLabel(mother, container, healthLvl) {
  const s = getStrain(mother.strainCode);
  const payload = JSON.stringify({
    id: mother.id,
    strainCode: s.code,
    strainName: s.name,
    status: mother.status,
    location: mother.location || "",
  });
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
  const win = window.open("", "_blank");
  if (!win) return;
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
    const lastTx = m.transplantHistory.length ? m.transplantHistory[m.transplantHistory.length - 1] : null;
    const container = lastTx ? lastTx.container : "";
    const daysInContainer = lastTx ? daysSince(lastTx.date) : "";
    const totalClones = m.cloneLog.reduce((a, c) => a + (parseInt(c.count) || 0), 0);
    const lastAmend = m.amendmentLog.length ? m.amendmentLog[0].date : "";
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

  const [detailMother, setDetailMother] = useState(null);
  const [detailTab, setDetailTab] = useState("Overview");
  const [addForm, setAddForm] = useState(null);

  const [showTransplantModal, setShowTransplantModal] = useState(false);
  const [transplantForm, setTransplantForm] = useState({ container: "Black Pot", date: today(), dateUnknown: false });
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendForm, setAmendForm] = useState({ date: today(), amendment: "", notes: "" });
  const [amendSearch, setAmendSearch] = useState("");
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneForm, setCloneForm] = useState({ date: today(), count: "", notes: "" });
  const [showFeedingModal, setShowFeedingModal] = useState(false);
  const [feedingForm, setFeedingForm] = useState({ date: today(), type: "Water Only", notes: "" });

  useEffect(() => {
    const stored = load("mothers_v1");
    if (stored) {
      // Migrate: add feedingLog and photos if missing on existing mothers
      setMothers(stored.map(m => ({ feedingLog: [], photos: [], ...m })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) save("mothers_v1", mothers);
  }, [mothers, loading]);

  useEffect(() => {
    if (detailMother) {
      const updated = mothers.find(m => m.id === detailMother.id);
      if (updated) setDetailMother(updated);
    }
  }, [mothers]);

  function addMother(data) {
    setMothers(prev => [{ ...defaultMother(), ...data, id: uid(), createdAt: today() }, ...prev]);
  }
  function updateMother(id, patch) {
    setMothers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }
  function deleteMother(id) {
    setMothers(prev => prev.filter(m => m.id !== id));
    setDetailMother(null);
  }
  function addTransplant(motherId, entry) {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, transplantHistory: [...m.transplantHistory, { ...entry, id: uid() }].sort((a, b) => a.date.localeCompare(b.date)) }
        : m
    ));
  }
  function removeTransplant(motherId, entryId) {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, transplantHistory: m.transplantHistory.filter(t => t.id !== entryId) }
        : m
    ));
  }
  function addAmendment(motherId, entry) {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, amendmentLog: [{ ...entry, id: uid() }, ...m.amendmentLog] }
        : m
    ));
  }
  function removeAmendment(motherId, entryId) {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, amendmentLog: m.amendmentLog.filter(a => a.id !== entryId) }
        : m
    ));
  }
  function addCloneEntry(motherId, entry) {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, cloneLog: [{ ...entry, id: uid() }, ...m.cloneLog] }
        : m
    ));
  }
  function removeCloneEntry(motherId, entryId) {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, cloneLog: m.cloneLog.filter(c => c.id !== entryId) }
        : m
    ));
  }
  function addFeedingEntry(motherId, entry) {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, feedingLog: [{ ...entry, id: uid() }, ...(m.feedingLog || [])] }
        : m
    ));
  }
  function removeFeedingEntry(motherId, entryId) {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, feedingLog: (m.feedingLog || []).filter(f => f.id !== entryId) }
        : m
    ));
  }
  function addPhoto(motherId, photo) {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, photos: [{ ...photo, id: uid() }, ...(m.photos || [])] }
        : m
    ));
  }
  function removePhoto(motherId, photoId) {
    setMothers(prev => prev.map(m =>
      m.id === motherId
        ? { ...m, photos: (m.photos || []).filter(p => p.id !== photoId) }
        : m
    ));
  }

  const active = mothers.filter(m => m.status === "Active");
  const sidelined = mothers.filter(m => m.status === "Sidelined");
  const totalClones = mothers.reduce((s, m) => s + m.cloneLog.reduce((a, c) => a + (parseInt(c.count) || 0), 0), 0);

  function currentContainer(mother) {
    if (!mother.transplantHistory.length) return null;
    return mother.transplantHistory[mother.transplantHistory.length - 1].container;
  }
  function currentTransplantDate(mother) {
    if (!mother.transplantHistory.length) return null;
    return mother.transplantHistory[mother.transplantHistory.length - 1].date;
  }

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
      photos: [],
    });
    setAddForm(null);
    setTab("Mothers");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-zinc-600 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 max-w-md mx-auto flex flex-col pb-8">
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Mother Log</h1>
            <p className="text-zinc-600 text-xs mt-0.5">Stacks Family Farms</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportMotherCSV(mothers)}
              title="Export CSV"
              className="text-zinc-500 hover:text-white text-base w-8 h-8 flex items-center justify-center border border-zinc-700 rounded-xl transition-colors"
            >↓</button>
            <button
              onClick={openAddForm}
              className="bg-emerald-800/50 hover:bg-emerald-700/60 border border-emerald-700/50 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
            >
              + Add Mother
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {["Summary", "Mothers", "Add"].map(t => (
            <button
              key={t}
              onClick={() => { if (t === "Add") { openAddForm(); } else { setTab(t); } }}
              className={`flex-1 text-xs font-semibold py-1.5 px-2 rounded-lg transition-colors ${
                tab === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 flex-1">
        {tab === "Summary" && (
          <SummaryTab
            mothers={mothers}
            active={active}
            sidelined={sidelined}
            totalClones={totalClones}
            onSelectMother={m => { setDetailMother(m); setDetailTab("Overview"); }}
          />
        )}
        {tab === "Mothers" && (
          <MothersTab
            mothers={mothers}
            currentContainer={currentContainer}
            currentTransplantDate={currentTransplantDate}
            onSelectMother={m => { setDetailMother(m); setDetailTab("Overview"); }}
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

      {detailMother && (
        <MotherDetailModal
          mother={detailMother}
          detailTab={detailTab}
          setDetailTab={setDetailTab}
          onClose={() => setDetailMother(null)}
          onUpdate={(patch) => updateMother(detailMother.id, patch)}
          onDelete={() => deleteMother(detailMother.id)}
          onPrintLabel={() => {
            const cont = currentContainer(detailMother);
            printMotherLabel(detailMother, cont, detailMother.healthLevel);
          }}
          currentContainer={currentContainer}
          currentTransplantDate={currentTransplantDate}
          showTransplantModal={showTransplantModal}
          setShowTransplantModal={setShowTransplantModal}
          transplantForm={transplantForm}
          setTransplantForm={setTransplantForm}
          onAddTransplant={(entry) => { addTransplant(detailMother.id, entry); setShowTransplantModal(false); }}
          onRemoveTransplant={(eid) => removeTransplant(detailMother.id, eid)}
          showAmendModal={showAmendModal}
          setShowAmendModal={setShowAmendModal}
          amendForm={amendForm}
          setAmendForm={setAmendForm}
          amendSearch={amendSearch}
          setAmendSearch={setAmendSearch}
          onAddAmendment={(entry) => { addAmendment(detailMother.id, entry); setShowAmendModal(false); setAmendSearch(""); }}
          onRemoveAmendment={(eid) => removeAmendment(detailMother.id, eid)}
          showCloneModal={showCloneModal}
          setShowCloneModal={setShowCloneModal}
          cloneForm={cloneForm}
          setCloneForm={setCloneForm}
          onAddCloneEntry={(entry) => { addCloneEntry(detailMother.id, entry); setShowCloneModal(false); }}
          onRemoveCloneEntry={(eid) => removeCloneEntry(detailMother.id, eid)}
          showFeedingModal={showFeedingModal}
          setShowFeedingModal={setShowFeedingModal}
          feedingForm={feedingForm}
          setFeedingForm={setFeedingForm}
          onAddFeedingEntry={(entry) => { addFeedingEntry(detailMother.id, entry); setShowFeedingModal(false); }}
          onRemoveFeedingEntry={(eid) => removeFeedingEntry(detailMother.id, eid)}
          onAddPhoto={(photo) => addPhoto(detailMother.id, photo)}
          onRemovePhoto={(photoId) => removePhoto(detailMother.id, photoId)}
        />
      )}
    </div>
  );
}

// ── Summary Tab ────────────────────────────────────────────────────────────
function SummaryTab({ mothers, active, sidelined, totalClones, onSelectMother }) {
  // Needs water: Active mothers not fed in 3+ days (or never fed)
  const needsWater = active.filter(m => {
    const last = lastFeedingDate(m.feedingLog);
    const days = daysSince(last);
    return days === null || days >= 3;
  });

  const strainCounts = mothers.reduce((acc, m) => {
    const s = getStrain(m.strainCode);
    const key = `${s.code} – ${s.name}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const amendCounts = mothers.flatMap(m => m.amendmentLog).reduce((acc, a) => {
    acc[a.amendment] = (acc[a.amendment] || 0) + 1;
    return acc;
  }, {});
  const topAmends = Object.entries(amendCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {Object.entries(strainCounts).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => (
              <div key={name} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 last:border-0">
                <span className="text-xs text-zinc-300">{name}</span>
                <span className="text-xs text-zinc-500">{cnt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topAmends.length > 0 && (
        <div>
          <SectionLabel>Most Used Amendments</SectionLabel>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {topAmends.map(([name, cnt]) => (
              <div key={name} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 last:border-0">
                <span className="text-xs text-zinc-300">{name}</span>
                <span className="text-xs text-zinc-500">{cnt}x</span>
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
                <button key={m.id} onClick={() => onSelectMother(m)} className="w-full bg-sky-950/30 border border-sky-800/40 rounded-xl px-4 py-3 text-left">
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

      {sidelined.length > 0 && (
        <div>
          <SectionLabel>Sidelined</SectionLabel>
          <div className="space-y-2">
            {sidelined.map(m => {
              const s = getStrain(m.strainCode);
              return (
                <button key={m.id} onClick={() => onSelectMother(m)} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-left">
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
}

// ── Mothers Tab ────────────────────────────────────────────────────────────
function MothersTab({ mothers, currentContainer, currentTransplantDate, onSelectMother }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = mothers
    .filter(m => filter === "All" || m.status === filter)
    .filter(m => {
      if (!search.trim()) return true;
      const s = getStrain(m.strainCode);
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.code.includes(q) || (m.location || "").toLowerCase().includes(q);
    });

  return (
    <div className="space-y-3">
      <input type="text" placeholder="Search strain, code, location..." value={search} onChange={e => setSearch(e.target.value)} className={inputCls} />
      <div className="flex gap-1.5 flex-wrap">
        {["All", "Active", "Sidelined"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${filter === f ? "bg-zinc-700 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>
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
                Tap <span className="text-emerald-400 font-medium">+ Add Mother</span> to get started
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
        <div className="space-y-2">
          {filtered.map(m => {
            const s = getStrain(m.strainCode);
            const container = currentContainer(m);
            const txDate = currentTransplantDate(m);
            const days = daysSince(txDate);
            const totalClones = m.cloneLog.reduce((a, c) => a + (parseInt(c.count) || 0), 0);
            return (
              <button key={m.id} onClick={() => onSelectMother(m)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-left hover:border-zinc-700 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{s.code}</span>
                      <Badge label={m.status} colorClass={statusBadgeColor(m.status)} />
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5 truncate">{s.name}</div>
                    {m.location && <div className="text-xs text-zinc-600 mt-0.5">{m.location}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <HealthDots level={m.healthLevel} />
                    {container && <ContainerBadge container={container} />}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2.5">
                  {container && <span className="text-[10px] text-zinc-600">{txDate ? `${days}d in container` : "Date unknown"}</span>}
                  {totalClones > 0 && <span className="text-[10px] text-zinc-600">{totalClones} clones taken</span>}
                  {m.amendmentLog.length > 0 && <span className="text-[10px] text-zinc-600">{m.amendmentLog.length} amendments</span>}
                </div>
              </button>
            );
          })}
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
            <button key={s} onClick={() => f("status", s)} className={`flex-1 text-xs py-2 rounded-xl font-medium border transition-colors ${form.status === s ? statusBadgeColor(s) + " border-current" : "bg-zinc-800 border-zinc-700 text-zinc-500"}`}>
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
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
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
function MotherDetailModal({
  mother, detailTab, setDetailTab, onClose, onUpdate, onDelete, onPrintLabel,
  currentContainer, currentTransplantDate,
  showTransplantModal, setShowTransplantModal, transplantForm, setTransplantForm,
  onAddTransplant, onRemoveTransplant,
  showAmendModal, setShowAmendModal, amendForm, setAmendForm, amendSearch, setAmendSearch,
  onAddAmendment, onRemoveAmendment,
  showCloneModal, setShowCloneModal, cloneForm, setCloneForm,
  onAddCloneEntry, onRemoveCloneEntry,
  showFeedingModal, setShowFeedingModal, feedingForm, setFeedingForm,
  onAddFeedingEntry, onRemoveFeedingEntry,
  onAddPhoto, onRemovePhoto,
}) {
  const s = getStrain(mother.strainCode);
  const container = currentContainer(mother);
  const txDate = currentTransplantDate(mother);
  const daysInContainer = daysSince(txDate);
  const totalClones = mother.cloneLog.reduce((a, c) => a + (parseInt(c.count) || 0), 0);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState(mother.notes || "");
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingHealth, setEditingHealth] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationVal, setLocationVal] = useState(mother.location || "");
  const [sendToCloneEntry, setSendToCloneEntry] = useState(null);
  const DETAIL_TABS = ["Overview", "Transplants", "Amendments", "Clones", "Feeding", "Photos"];

  const feedingLog = mother.feedingLog || [];
  const lastFed = lastFeedingDate(feedingLog);
  const daysSinceFed = daysSince(lastFed);

  return (
    <>
      <Modal title={`${s.code} – ${s.name}`} onClose={onClose}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Badge label={mother.status} colorClass={statusBadgeColor(mother.status)} />
          <Badge label={healthLabel(mother.healthLevel)} colorClass={healthBg(mother.healthLevel)} />
          {mother.location && <span className="text-xs text-zinc-500">{mother.location}</span>}
        </div>

        <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1 mb-4 overflow-x-auto">
          {DETAIL_TABS.map(t => (
            <button key={t} onClick={() => setDetailTab(t)} className={`flex-shrink-0 text-[10px] font-semibold py-1.5 px-2.5 rounded-lg transition-colors ${detailTab === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
              {t}
            </button>
          ))}
        </div>

        {detailTab === "Overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="Days in Container" value={txDate ? (daysInContainer ?? "—") : "Unknown"} colorClass={txDate ? "text-sky-400" : "text-zinc-600"} />
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
            <button onClick={() => { if (window.confirm("Delete this mother plant? This cannot be undone.")) onDelete(); }} className="w-full border border-red-900/50 text-red-500 hover:text-red-400 hover:border-red-800 text-xs rounded-xl py-2.5 transition-colors">
              Delete Mother Plant
            </button>
          </div>
        )}

        {detailTab === "Transplants" && (
          <div className="space-y-3">
            <button onClick={() => { setTransplantForm({ container: container || "Black Pot", date: today(), dateUnknown: false }); setShowTransplantModal(true); }} className={btnPrimary}>
              + Log Transplant
            </button>
            {mother.transplantHistory.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">No transplants recorded.</div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {[...mother.transplantHistory].reverse().map((t, i) => {
                  const isLatest = i === 0;
                  const days = isLatest ? daysSince(t.date) : null;
                  return (
                    <div key={t.id} className={`flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 last:border-0 ${isLatest ? "bg-zinc-800/30" : ""}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-zinc-200 font-medium">{t.container}</span>
                          {isLatest && <Badge label="Current" colorClass="bg-sky-900/50 text-sky-300 border-sky-700/40" />}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">{t.date ? `${fmtDate(t.date)}${days !== null ? ` · ${days}d ago` : ""}` : "Date unknown"}</div>
                      </div>
                      <button onClick={() => onRemoveTransplant(t.id)} className="text-zinc-700 hover:text-red-500 text-sm w-7 h-7 flex items-center justify-center rounded-lg transition-colors">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {detailTab === "Amendments" && (
          <div className="space-y-3">
            <button onClick={() => { setAmendForm({ date: today(), amendment: "", notes: "" }); setAmendSearch(""); setShowAmendModal(true); }} className={btnPrimary}>
              + Log Amendment
            </button>
            {mother.amendmentLog.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">No amendments recorded.</div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {mother.amendmentLog.map(a => (
                  <div key={a.id} className="flex items-start justify-between px-4 py-3 border-b border-zinc-800/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-200 font-medium">{a.amendment}</div>
                      {a.notes && <div className="text-xs text-zinc-500 mt-0.5 truncate">{a.notes}</div>}
                      <div className="text-xs text-zinc-600 mt-0.5">{fmtDate(a.date)}</div>
                    </div>
                    <button onClick={() => onRemoveAmendment(a.id)} className="text-zinc-700 hover:text-red-500 text-sm w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {detailTab === "Clones" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Total Taken" value={totalClones} colorClass="text-emerald-400" />
              <StatBox label="Sessions" value={mother.cloneLog.length} colorClass="text-sky-400" />
            </div>
            <button onClick={() => { setCloneForm({ date: today(), count: "", notes: "" }); setShowCloneModal(true); }} className={btnPrimary}>
              + Log Clone Cut
            </button>
            {mother.cloneLog.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">No clone sessions recorded.</div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {mother.cloneLog.map(c => (
                  <div key={c.id} className="border-b border-zinc-800/50 last:border-0">
                    <div className="flex items-start justify-between px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-emerald-300 font-bold">{c.count}</span>
                          <span className="text-xs text-zinc-400">clones</span>
                        </div>
                        {c.notes && <div className="text-xs text-zinc-500 mt-0.5 truncate">{c.notes}</div>}
                        <div className="text-xs text-zinc-600 mt-0.5">{fmtDate(c.date)}</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setSendToCloneEntry(c)}
                          className="text-[10px] text-sky-400 hover:text-sky-300 border border-sky-800/50 hover:border-sky-700 rounded-lg px-2 py-1 transition-colors"
                        >
                          Send to Clone Log
                        </button>
                        <button onClick={() => onRemoveCloneEntry(c.id)} className="text-zinc-700 hover:text-red-500 text-sm w-7 h-7 flex items-center justify-center rounded-lg transition-colors">✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {detailTab === "Photos" && (
          <PhotosTab
            mother={mother}
            onAddPhoto={onAddPhoto}
            onRemovePhoto={onRemovePhoto}
          />
        )}

        {detailTab === "Feeding" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                <div className={`text-2xl font-bold ${feedingDaysColor(daysSinceFed)}`}>
                  {daysSinceFed === null ? "—" : daysSinceFed}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">Days Since Fed</div>
              </div>
              <StatBox label="Total Sessions" value={feedingLog.length} colorClass="text-sky-400" />
            </div>
            <button
              onClick={() => { setFeedingForm({ date: today(), type: "Water Only", notes: "" }); setShowFeedingModal(true); }}
              className={btnPrimary}
            >
              + Log Feeding
            </button>
            {feedingLog.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">No feedings recorded.</div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {feedingLog.map(f => (
                  <div key={f.id} className="flex items-start justify-between px-4 py-3 border-b border-zinc-800/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-200 font-medium">{f.type}</div>
                      {f.notes && <div className="text-xs text-zinc-500 mt-0.5 truncate">{f.notes}</div>}
                      <div className="text-xs text-zinc-600 mt-0.5">{fmtDate(f.date)}</div>
                    </div>
                    <button onClick={() => onRemoveFeedingEntry(f.id)} className="text-zinc-700 hover:text-red-500 text-sm w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
            <button onClick={() => onAddTransplant({ ...transplantForm, date: transplantForm.dateUnknown ? null : transplantForm.date })} className={btnPrimary}>Save Transplant</button>
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
                value={amendSearch || amendForm.amendment}
                onChange={e => { setAmendSearch(e.target.value); setAmendForm(p => ({ ...p, amendment: e.target.value })); }}
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
            <button onClick={() => { if (amendForm.amendment.trim()) onAddAmendment(amendForm); }} className={btnPrimary} disabled={!amendForm.amendment.trim()}>
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
            <button onClick={() => { if (cloneForm.count) onAddCloneEntry(cloneForm); }} className={btnPrimary} disabled={!cloneForm.count}>
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
            <button onClick={() => onAddFeedingEntry(feedingForm)} className={btnPrimary}>
              Save Feeding
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
}

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
      // Test if localStorage has space
      try {
        localStorage.setItem("__photo_test__", dataUrl);
        localStorage.removeItem("__photo_test__");
      } catch {
        setStorageWarning(true);
        setUploading(false);
        return;
      }
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
