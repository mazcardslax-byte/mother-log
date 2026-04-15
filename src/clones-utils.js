// ── Clones Tab — pure utility functions ──────────────────────────────────────
// No React, no Supabase. All functions are pure/testable.

import { uid, today, fmtDate, daysSince } from "./shared";

export { uid, today, fmtDate, daysSince };

// ── Constants ─────────────────────────────────────────────────────────────────
export const TRAY_ALERT_DAYS = 14;

export const TESTER_CODES = ["2020", "2021", "2022", "2023", "2024"];

export const STATUS_COLORS = {
  "Cloned":       "bg-emerald-900/50 text-emerald-300 border-emerald-700/40",
  "Transplanted": "bg-sky-900/50 text-sky-300 border-sky-700/40",
};

export const ROUND_COLORS = {
  "Upcoming": "bg-teal-900/50 text-teal-300 border-teal-700/40",
  "Next":     "bg-orange-900/50 text-orange-300 border-orange-700/40",
  "Archived": "bg-[#1a1a1a] text-[#6a5a3a] border-[#2a2418]",
};

export const STATUSES = ["Cloned", "Transplanted"];

export const STRAIN_PALETTE = [
  "#34d399", "#60a5fa", "#f472b6", "#fb923c", "#a78bfa",
  "#facc15", "#2dd4bf", "#f87171", "#818cf8", "#4ade80",
  "#e879f9", "#38bdf8",
];

export const CLONE_SUB_TABS = ["Summary", "Log", "Add Entry", "Trays", "Strains"];

// ── Month map for smart parser ────────────────────────────────────────────────
export const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7,
  september: 8, october: 9, november: 10, december: 11,
};

// ── Strain code resolver ──────────────────────────────────────────────────────
/**
 * Resolve a raw input token to a strain + optional tester suffix.
 * Returns { strain, suffix } or null if not matched.
 */
export function resolveCode(input, strains) {
  const clean = input.toLowerCase().trim();
  const exact = strains.find(s => s.code.toLowerCase() === clean);
  if (exact) return { strain: exact, suffix: "" };
  const match = clean.match(/^(\d+)([a-z]+)$/);
  if (match && TESTER_CODES.includes(match[1])) {
    const base = strains.find(s => s.code === match[1]);
    if (base) return { strain: base, suffix: match[2].toUpperCase() };
  }
  return null;
}

// ── Smart entry parser ────────────────────────────────────────────────────────
/**
 * Parse a free-text entry like "19 2023b march 24" into { qty, resolved, dateStr }.
 */
export function parseSmartEntry(raw, strains) {
  const tokens = raw.toLowerCase().trim().split(/[\s,]+/);
  let qty = null, codeRaw = null, month = null, day = null, year = new Date().getFullYear();
  for (const t of tokens) {
    if (!codeRaw && resolveCode(t, strains)) { codeRaw = t; continue; }
    if (!qty && /^\d+$/.test(t) && parseInt(t) > 0 && parseInt(t) <= 1900) {
      // If month is already set and this could be a day (1–31), treat it as day, not qty
      if (month !== null && day === null && parseInt(t) <= 31) { day = parseInt(t); continue; }
      qty = parseInt(t); continue;
    }
    if (/^\d{4}$/.test(t) && parseInt(t) > 1900) { year = parseInt(t); continue; }
    if (MONTH_MAP[t] !== undefined && month === null) { month = MONTH_MAP[t]; continue; }
    if (month !== null && day === null && /^\d{1,2}(st|nd|rd|th)?$/.test(t)) { day = parseInt(t); continue; }
  }
  if (month === null) {
    for (const t of tokens) {
      const slash = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
      if (slash) {
        const m = parseInt(slash[1]) - 1, d = parseInt(slash[2]);
        if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
          month = m; day = d;
          if (slash[3]) { const y = parseInt(slash[3]); year = y < 100 ? 2000 + y : y; }
          break;
        }
      }
    }
  }
  const resolved = codeRaw ? resolveCode(codeRaw, strains) : null;
  const dateStr = (month !== null && day !== null)
    ? new Date(year, month, day).toISOString().split("T")[0]
    : null;
  return { qty, resolved, dateStr };
}

// ── Tray helpers ──────────────────────────────────────────────────────────────
/**
 * Auto-generate the next tray code for a given strain (e.g. "2023-T3").
 */
export function autoTrayCode(trays, strainCode) {
  if (!strainCode) return "";
  const n = trays.filter(t => t.strainCode === strainCode).length + 1;
  return `${strainCode}-T${n}`;
}

/**
 * Returns trays whose age >= TRAY_ALERT_DAYS and are still Active.
 */
export function getAlertTrays(trays) {
  return trays.filter(t => t.status === "Active" && daysSince(t.dateStarted) >= TRAY_ALERT_DAYS);
}

// ── Survival rate helpers ─────────────────────────────────────────────────────
/**
 * Compute per-strain transplant survival from plants that originated in trays.
 * Returns { [strainName]: { transplanted, total } }
 */
export function calcSurvivalByStrain(plants) {
  return plants.reduce((acc, p) => {
    if (!p.tray) return acc;
    const n = p.strainName;
    if (!acc[n]) acc[n] = { transplanted: 0, total: 0 };
    if (p.status === "Transplanted") acc[n].transplanted++;
    acc[n].total++;
    return acc;
  }, {});
}

/**
 * Compute transplant pipeline rows (in-tray totals vs. individually-logged counts)
 * for the Summary tab.
 * Returns sorted array of { name, trayCount, loggedCount }.
 */
export function buildTransplantPipeline(trays, activePlants) {
  const trayTotals = trays
    .filter(t => t.status === "Active")
    .reduce((a, t) => {
      if (!t.strainName) return a;
      if (!a[t.strainName]) a[t.strainName] = { trayCount: 0 };
      a[t.strainName].trayCount += (t.count || 0);
      return a;
    }, {});

  const loggedTotals = activePlants
    .filter(p => p.status === "Cloned")
    .reduce((a, p) => {
      if (!a[p.strainName]) a[p.strainName] = { loggedCount: 0 };
      a[p.strainName].loggedCount++;
      return a;
    }, {});

  const allStrains = new Set([...Object.keys(trayTotals), ...Object.keys(loggedTotals)]);
  return [...allStrains].sort().map(name => ({
    name,
    trayCount: trayTotals[name]?.trayCount || 0,
    loggedCount: loggedTotals[name]?.loggedCount || 0,
  }));
}

// ── Filter / group plants ─────────────────────────────────────────────────────
/**
 * Filter plants by archived state + strain/round/status filters,
 * then group by strainName.
 * Returns { displayPlants, grouped }.
 */
export function filterAndGroupPlants(plants, { showArchived, filterStrain, filterRound, filterStatus }) {
  const displayPlants = [], grouped = {};
  for (const p of plants) {
    if (showArchived ? !p.archived : p.archived) continue;
    if (filterStrain !== "All" && p.strainName !== filterStrain) continue;
    if (filterRound !== "All" && p.round !== filterRound) continue;
    if (filterStatus !== "All" && p.status !== filterStatus) continue;
    displayPlants.push(p);
    if (!grouped[p.strainName]) grouped[p.strainName] = [];
    grouped[p.strainName].push(p);
  }
  return { displayPlants, grouped };
}

// ── Strain color map ──────────────────────────────────────────────────────────
/**
 * Map each strain name to a color from the palette (wrapping by index).
 */
export function buildStrainColorMap(names, palette = STRAIN_PALETTE) {
  return Object.fromEntries(names.map((n, i) => [n, palette[i % palette.length]]));
}

// ── Transplant tray logic ─────────────────────────────────────────────────────
/**
 * Pure function that returns the updated plants array and trays array
 * after a tray transplant action.
 *
 * @param {object[]} plants  - current plants array
 * @param {object[]} trays   - current trays array
 * @param {string}   trayCode
 * @param {string}   date    - ISO date string
 * @param {number|null} survived - override count, or null to use logged count
 * @param {string}   round
 * @returns {{ nextPlants, nextTrays }}
 */
export function applyTrayTransplant(plants, trays, trayCode, date, survived, round) {
  const tray = trays.find(t => t.code === trayCode);
  const loggedInTray = plants.filter(p => p.tray === trayCode && p.status === "Cloned" && !p.archived);
  const survivedCount = survived != null ? survived : loggedInTray.length;
  const toTransplantCount = Math.min(survivedCount, loggedInTray.length);
  const transplantIds = new Set(loggedInTray.slice(0, toTransplantCount).map(p => p.id));
  const archiveIds = new Set(loggedInTray.slice(toTransplantCount).map(p => p.id));

  const newSurvivorPlants = survivedCount > loggedInTray.length
    ? Array.from({ length: survivedCount - loggedInTray.length }, () => ({
        id: uid(),
        strainCode: tray?.strainCode || "",
        strainName: tray?.strainName || "",
        dateCloned: tray?.dateStarted || null,
        dateTransplanted: date,
        pot: "Black Pot",
        round: round || "Next",
        status: "Transplanted",
        notes: "",
        batchNote: `Transplanted from tray ${trayCode}`,
        tray: trayCode,
        archived: false,
      }))
    : [];

  const trayTotal = tray?.count ?? null;
  const extraNonSurvived = trayTotal != null
    ? Math.max(0, (trayTotal - survivedCount) - archiveIds.size)
    : 0;
  const newNonSurvivorPlants = extraNonSurvived > 0
    ? Array.from({ length: extraNonSurvived }, () => ({
        id: uid(),
        strainCode: tray?.strainCode || "",
        strainName: tray?.strainName || "",
        dateCloned: tray?.dateStarted || null,
        dateTransplanted: null,
        pot: "Black Pot",
        round: round || "Next",
        status: "Cloned",
        notes: "",
        batchNote: `Did not survive — tray ${trayCode}`,
        tray: trayCode,
        archived: true,
      }))
    : [];

  const nextPlants = [
    ...plants.map(p => {
      if (transplantIds.has(p.id)) return { ...p, status: "Transplanted", dateTransplanted: date };
      if (archiveIds.has(p.id)) return { ...p, archived: true };
      return p;
    }),
    ...newSurvivorPlants,
    ...newNonSurvivorPlants,
  ];

  const nextTrays = trays.map(t =>
    t.code === trayCode ? { ...t, status: "Done", survived: survivedCount } : t
  );

  return { nextPlants, nextTrays };
}

// ── Search plants ─────────────────────────────────────────────────────────────
/**
 * Filter plants by a free-text query across strain name, code, status,
 * tray, notes, batchNote, round.
 */
export function searchPlants(plants, query) {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return plants.filter(p =>
    p.strainName?.toLowerCase().includes(q) ||
    p.strainCode?.toLowerCase().includes(q) ||
    p.status?.toLowerCase().includes(q) ||
    p.tray?.toLowerCase().includes(q) ||
    p.notes?.toLowerCase().includes(q) ||
    p.batchNote?.toLowerCase().includes(q) ||
    p.round?.toLowerCase().includes(q)
  );
}

/**
 * Group an array of plants by strainName.
 * Returns { [strainName]: plant[] }
 */
export function groupByStrain(plants) {
  return plants.reduce((acc, p) => {
    if (!acc[p.strainName]) acc[p.strainName] = [];
    acc[p.strainName].push(p);
    return acc;
  }, {});
}
