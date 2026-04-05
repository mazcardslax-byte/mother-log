// ── Shared constants, utilities, and UI primitives ──────────────────────────
// Imported by App.jsx and MotherDetail.jsx

// ── Image Compression ───────────────────────────────────────────────────────
export function compressImage(file, maxPx = 800, quality = 0.7) {
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

// ── Strains ────────────────────────────────────────────────────────────────
export const STRAINS = [
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

export const STRAINS_MAP = new Map(STRAINS.map(s => [s.code, s]));
export function getStrain(code) {
  return STRAINS_MAP.get(code) || { code, name: "Unknown" };
}

export const CONTAINERS = [
  "Black Pot",
  "Green Pot",
  "3 Gallon",
  "5 Gallon Bucket",
  "7 Gallon",
  "12 Gallon",
];

export const MOTHER_STATUSES = ["Active", "Sidelined"];

export const COMMON_AMENDMENTS = [
  "Fish emulsion", "Recharge", "Top dress compost", "Cal-mag",
  "Kelp meal", "Worm castings", "Neem meal", "Mycorrhizae",
  "Epsom salt", "Unsulfured molasses", "Silica", "pH down", "pH up",
];

export const FEEDING_TYPES = [
  "Water Only",
  "Light Feed",
  "Full Feed",
  "Flush",
  "Foliar Spray",
  "Compost Tea",
];

export const DETAIL_TABS = ["Overview", "History", "Photos"];

export const TYPE_META = {
  transplant: { label: "Transplant", text: "text-sky-400",    border: "border-sky-700" },
  amendment:  { label: "Amendment",  text: "text-violet-400", border: "border-violet-700" },
  feeding:    { label: "Feeding",    text: "text-emerald-400", border: "border-emerald-700" },
  clone:      { label: "Clone",      text: "text-stone-300",  border: "border-stone-600" },
  reduction:  { label: "Reduction",  text: "text-red-400",    border: "border-red-700" },
};

// ── Utilities ──────────────────────────────────────────────────────────────
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export function today() { return new Date().toISOString().split("T")[0]; }
export function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}/${y}`;
}
export function daysSince(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  const diff = Date.now() - local.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function currentContainer(mother) {
  if (!mother.transplantHistory.length) return null;
  return mother.transplantHistory[mother.transplantHistory.length - 1].container;
}
export function currentTransplantDate(mother) {
  if (!mother.transplantHistory.length) return null;
  return mother.transplantHistory[mother.transplantHistory.length - 1].date;
}

// ── Threshold color helper ─────────────────────────────────────────────────
export function thresholdColor(value, thresholds) {
  return (thresholds.find(t => value <= t.max) ?? thresholds.at(-1)).cls;
}

// ── Health helpers ─────────────────────────────────────────────────────────
export const HEALTH_COLOR_THRESHOLDS = [
  { max: 2, cls: "text-red-400" },
  { max: 3, cls: "text-yellow-400" },
  { max: 5, cls: "text-emerald-400" },
];
export const HEALTH_BG_THRESHOLDS = [
  { max: 2, cls: "bg-red-900/40 border-red-700/40 text-red-300" },
  { max: 3, cls: "bg-yellow-900/40 border-yellow-700/40 text-yellow-300" },
  { max: 5, cls: "bg-emerald-900/40 border-emerald-700/40 text-emerald-300" },
];
export const HEALTH_LABELS = { 5: "Excellent (5)", 4: "Good (4)", 3: "Moderate (3)", 2: "Fair (2)", 1: "Poor (1)" };
export const HEALTH_BADGE_CLASSES = {
  5: "bg-emerald-900/40 border-emerald-700/40 text-emerald-300",
  4: "bg-emerald-900/30 border-emerald-800/40 text-emerald-400",
  3: "bg-yellow-900/40 border-yellow-700/40 text-yellow-300",
  2: "bg-red-900/30 border-red-800/40 text-red-400",
  1: "bg-red-900/40 border-red-700/40 text-red-300",
};
export function healthColor(level) { return thresholdColor(level, HEALTH_COLOR_THRESHOLDS); }
export function healthBg(level) { return thresholdColor(level, HEALTH_BG_THRESHOLDS); }
export function healthLabel(level) {
  return ["", "Poor", "Fair", "Moderate", "Good", "Excellent"][level] || "—";
}

// ── Feeding helpers ────────────────────────────────────────────────────────
export function lastFeedingDate(feedingLog) {
  if (!feedingLog || feedingLog.length === 0) return null;
  return feedingLog.reduce((latest, f) => {
    return !latest || f.date > latest ? f.date : latest;
  }, null);
}

export const FEEDING_DAYS_THRESHOLDS = [
  { max: 2, cls: "text-emerald-400" },
  { max: 4, cls: "text-yellow-400" },
  { max: Infinity, cls: "text-red-400" },
];
export function feedingDaysColor(days) {
  if (days === null) return "text-[#6a5a3a]";
  return thresholdColor(days, FEEDING_DAYS_THRESHOLDS);
}

export function daysInVeg(mother) {
  const dates = [
    ...(mother.cloneLog || []).map(c => c.date),
    ...(mother.reductionLog || []).map(r => r.date),
  ].filter(Boolean);
  const latest = dates.length ? dates.sort().at(-1) : null;
  return daysSince(latest ?? mother.createdAt);
}

export const VEG_DAYS_THRESHOLDS = [
  { max: 24, cls: "text-[#6a5a3a]" },
  { max: 29, cls: "text-yellow-400" },
  { max: Infinity, cls: "text-red-400" },
];
export function vegDaysColor(days) {
  if (days === null) return "text-[#6a5a3a]";
  return thresholdColor(days, VEG_DAYS_THRESHOLDS);
}

export function statusBadgeColor(status) {
  if (status === "Active") return "bg-emerald-900/50 text-emerald-300 border-emerald-700/40";
  if (status === "Sidelined") return "bg-[#1a1a1a] text-[#6a5a3a] border-[#2a2418]";
  return "bg-[#1a1a1a] text-[#6a5a3a] border-[#2a2418]";
}

export function cardAccentColor(m) {
  if (m.status === "Sidelined") return "border-l-[#2a2418]";
  if (m.healthLevel <= 2) return "border-l-red-500";
  if (m.healthLevel === 3) return "border-l-yellow-500";
  return "border-l-emerald-500";
}

// ── Style strings ──────────────────────────────────────────────────────────
export const inputCls = "w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] placeholder-[#6a5a3a] focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/40";
export const selectCls = "w-full bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5 text-sm text-[#f5f5f0] focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/40";
export const btnPrimary = "w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-[#0a0a0a] font-semibold text-sm rounded-xl py-3 transition-colors min-h-[44px]";
export const btnSecondary = "w-full bg-[#1a1a1a] hover:bg-[#222] active:bg-[#111] text-[#c5b08a] font-medium text-sm rounded-xl py-2.5 transition-colors border border-[#2a2418] min-h-[44px]";

// ── Shared UI components ───────────────────────────────────────────────────
export function Badge({ label, colorClass }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#0f0f0f] border border-[#2a2418] rounded-t-3xl w-full max-w-md shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-[#2a2418] rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2418] flex-shrink-0">
          <span className="text-[#f5f5f0] font-semibold text-sm">{title}</span>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-xl text-[#6a5a3a] active:text-[#f5f5f0] active:bg-[#1a1a1a] transition-colors">✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

export function StatBox({ label, value, colorClass, sub }) {
  return (
    <div className="bg-[#111111] border border-[#2a2418] rounded-xl p-3.5 text-center">
      <div className={`text-2xl font-bold tracking-tight ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-[#6a5a3a] mt-1 leading-tight font-medium uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[10px] text-[#6a5a3a] mt-0.5">{sub}</div>}
    </div>
  );
}

export function SectionLabel({ children }) {
  return <div className="text-[10px] text-[#6a5a3a] uppercase tracking-widest font-bold mb-2 px-0.5">{children}</div>;
}

export function FormField({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-[#c5b08a] mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}

export function HealthDots({ level }) {
  return (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i <= level
              ? level <= 2 ? "bg-red-400" : level === 3 ? "bg-yellow-400" : "bg-emerald-400"
              : "bg-[#2a2418]"
          }`}
        />
      ))}
    </div>
  );
}

export function ContainerBadge({ container }) {
  const idx = CONTAINERS.indexOf(container);
  const pct = idx < 0 ? 0 : Math.round(((idx + 1) / CONTAINERS.length) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-sky-300 font-medium">{container || "—"}</span>
      <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full min-w-[40px]">
        <div className="h-1 bg-sky-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
