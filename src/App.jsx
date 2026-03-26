import { useState, useEffect } from "react";

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

const MOTHER_STATUSES = ["Active", "Retired", "Quarantine"];

const COMMON_AMENDMENTS = [
  "Fish emulsion", "Recharge", "Top dress compost", "Cal-mag",
  "Kelp meal", "Worm castings", "Neem meal", "Mycorrhizae",
  "Epsom salt", "Unsulfured molasses", "Silica", "pH down", "pH up",
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
  const diff = Date.now() - new Date(dateStr).getTime();
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

function statusBadgeColor(status) {
  if (status === "Active") return "bg-emerald-900/50 text-emerald-300 border-emerald-700/40";
  if (status === "Retired") return "bg-zinc-800 text-zinc-500 border-zinc-700";
  if (status === "Quarantine") return "bg-orange-900/50 text-orange-300 border-orange-700/40";
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
    createdAt: today(),
  };
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
  const [transplantForm, setTransplantForm] = useState({ container: "Black Pot", date: today() });
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendForm, setAmendForm] = useState({ date: today(), amendment: "", notes: "" });
  const [amendSearch, setAmendSearch] = useState("");
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneForm, setCloneForm] = useState({ date: today(), count: "", notes: "" });

  useEffect(() => {
    const stored = load("mothers_v1");
    if (stored) setMothers(stored);
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

  const active = mothers.filter(m => m.status === "Active");
  const retired = mothers.filter(m => m.status === "Retired");
  const quarantine = mothers.filter(m => m.status === "Quarantine");
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
    });
    setTab("Add");
  }

  function submitAddForm() {
    if (!addForm.strainCode) return;
    const transplantHistory = addForm.initialContainer
      ? [{ id: uid(), container: addForm.initialContainer, date: addForm.initialDate }]
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
          <button
            onClick={openAddForm}
            className="bg-emerald-800/50 hover:bg-emerald-700/60 border border-emerald-700/50 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
          >
            + Add Mother
          </button>
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
            retired={retired}
            quarantine={quarantine}
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
        />
      )}
    </div>
  );
}

// ── Summary Tab ────────────────────────────────────────────────────────────
function SummaryTab({ mothers, active, retired, quarantine, totalClones, onSelectMother }) {
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
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Quarantine" value={quarantine.length} colorClass="text-orange-400" />
        <StatBox label="Retired" value={retired.length} colorClass="text-zinc-500" />
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

      {quarantine.length > 0 && (
        <div>
          <SectionLabel>Quarantine Alert</SectionLabel>
          <div className="space-y-2">
            {quarantine.map(m => {
              const s = getStrain(m.strainCode);
              return (
                <button key={m.id} onClick={() => onSelectMother(m)} className="w-full bg-orange-950/30 border border-orange-800/40 rounded-xl px-4 py-3 text-left">
                  <div className="text-sm text-orange-300 font-medium">{s.code} – {s.name}</div>
                  {m.location && <div className="text-xs text-zinc-500 mt-0.5">{m.location}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mothers.length === 0 && (
        <div className="text-center py-12 text-zinc-600 text-sm">
          No mother plants yet.<br />Tap "+ Add Mother" to get started.
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
        {["All", "Active", "Quarantine", "Retired"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${filter === f ? "bg-zinc-700 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-zinc-600 text-sm">{mothers.length === 0 ? "No mothers added yet." : "No results."}</div>
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
                  {days !== null && <span className="text-[10px] text-zinc-600">{days}d in container</span>}
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
        <input type="date" className={inputCls} value={form.initialDate} onChange={e => f("initialDate", e.target.value)} />
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

// ── Mother Detail Modal ────────────────────────────────────────────────────
function MotherDetailModal({
  mother, detailTab, setDetailTab, onClose, onUpdate, onDelete,
  currentContainer, currentTransplantDate,
  showTransplantModal, setShowTransplantModal, transplantForm, setTransplantForm,
  onAddTransplant, onRemoveTransplant,
  showAmendModal, setShowAmendModal, amendForm, setAmendForm, amendSearch, setAmendSearch,
  onAddAmendment, onRemoveAmendment,
  showCloneModal, setShowCloneModal, cloneForm, setCloneForm,
  onAddCloneEntry, onRemoveCloneEntry,
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
  const DETAIL_TABS = ["Overview", "Transplants", "Amendments", "Clones"];

  return (
    <>
      <Modal title={`${s.code} – ${s.name}`} onClose={onClose}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Badge label={mother.status} colorClass={statusBadgeColor(mother.status)} />
          <Badge label={healthLabel(mother.healthLevel)} colorClass={healthBg(mother.healthLevel)} />
          {mother.location && <span className="text-xs text-zinc-500">{mother.location}</span>}
        </div>

        <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1 mb-4">
          {DETAIL_TABS.map(t => (
            <button key={t} onClick={() => setDetailTab(t)} className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-colors ${detailTab === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
              {t}
            </button>
          ))}
        </div>

        {detailTab === "Overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="Days in Container" value={daysInContainer ?? "—"} colorClass="text-sky-400" />
              <StatBox label="Total Clones" value={totalClones} colorClass="text-emerald-400" />
              <StatBox label="Amendments" value={mother.amendmentLog.length} colorClass="text-violet-400" />
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3">
              <SectionLabel>Current Container</SectionLabel>
              {container ? <ContainerBadge container={container} /> : <span className="text-xs text-zinc-600">No transplant recorded</span>}
              {txDate && <div className="text-[10px] text-zinc-600 mt-1">Since {fmtDate(txDate)}</div>}
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
            <button onClick={() => { if (window.confirm("Delete this mother plant? This cannot be undone.")) onDelete(); }} className="w-full border border-red-900/50 text-red-500 hover:text-red-400 hover:border-red-800 text-xs rounded-xl py-2.5 transition-colors">
              Delete Mother Plant
            </button>
          </div>
        )}

        {detailTab === "Transplants" && (
          <div className="space-y-3">
            <button onClick={() => { setTransplantForm({ container: container || "Black Pot", date: today() }); setShowTransplantModal(true); }} className={btnPrimary}>
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
                        <div className="text-xs text-zinc-500 mt-0.5">{fmtDate(t.date)}{days !== null ? ` · ${days}d ago` : ""}</div>
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
                  <div key={c.id} className="flex items-start justify-between px-4 py-3 border-b border-zinc-800/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-emerald-300 font-bold">{c.count}</span>
                        <span className="text-xs text-zinc-400">clones</span>
                      </div>
                      {c.notes && <div className="text-xs text-zinc-500 mt-0.5 truncate">{c.notes}</div>}
                      <div className="text-xs text-zinc-600 mt-0.5">{fmtDate(c.date)}</div>
                    </div>
                    <button onClick={() => onRemoveCloneEntry(c.id)} className="text-zinc-700 hover:text-red-500 text-sm w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0">✕</button>
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
              <input type="date" className={inputCls} value={transplantForm.date} onChange={e => setTransplantForm(p => ({ ...p, date: e.target.value }))} />
            </FormField>
            <button onClick={() => onAddTransplant(transplantForm)} className={btnPrimary}>Save Transplant</button>
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
    </>
  );
}
