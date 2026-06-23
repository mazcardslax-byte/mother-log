import { useMemo, useState, useEffect } from "react";
import { loadFromDB } from "./supabase";
import { calcTrayRates, calcStrainComparison } from "./stats-utils";
import { SectionLabel, StatBox, selectCls } from "./shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function rateColor(rate) {
  if (rate >= 75) return "#30d158";
  if (rate >= 50) return "#ff9f0a";
  return "#ff453a";
}

function healthColor(h) {
  if (h >= 4.5) return "#30d158";
  if (h >= 3.5) return "#30d158";
  if (h >= 2.5) return "#ff9f0a";
  return "#ff453a";
}

function daysBadgeColor(days) {
  if (days === Infinity || days === null || days === undefined)
    return "text-[#ff453a] border-[#ff453a]/30";
  if (days > 10) return "text-[#ff453a] border-[#ff453a]/30";
  if (days > 6) return "text-[#ffd60a] border-[#ffd60a]/30";
  return "text-[#30d158] border-[#30d158]/30";
}

// ─── Section A: Clone Rooting Rates ──────────────────────────────────────────

function CloneRatesSection() {
  const [trays, setTrays] = useState([]);

  useEffect(() => {
    loadFromDB("clone_trays_v1").then((data) => {
      if (data) setTrays(data);
    });
  }, []);

  const { overall, byStrain } = useMemo(() => calcTrayRates(trays), [trays]);

  return (
    <div className="mb-7">
      <SectionLabel>Clone Rooting Rates</SectionLabel>

      {/* Summary row */}
      <div className="flex gap-2 mb-4">
        {[
          {
            label: "Overall",
            value: overall.count === 0 ? "—" : `${overall.rate}%`,
            style: {
              color:
                overall.count === 0
                  ? "rgba(235,235,245,0.3)"
                  : rateColor(overall.rate),
            },
          },
          {
            label: "Total in trays",
            value: overall.count === 0 ? "—" : overall.count,
            style: { color: "rgba(235,235,245,0.9)" },
          },
          {
            label: "Survived",
            value: overall.count === 0 ? "—" : overall.survived,
            style: { color: "rgba(235,235,245,0.9)" },
          },
        ].map(({ label, value, style }) => (
          <div
            key={label}
            className="flex-1 bg-[#1c1c1e] border border-white/10 rounded-xl p-3 text-center"
          >
            <div className="text-xl font-bold" style={style}>
              {value}
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {byStrain.length === 0 ? (
        <div className="text-white/30 text-sm text-center py-4">
          No clone data yet.
        </div>
      ) : (
        <div className="bg-[#1c1c1e] border border-white/10 rounded-xl p-4 space-y-3">
          {byStrain.map((entry) => (
            <div key={entry.strainCode} className="flex items-center gap-3">
              <div className="w-[88px] text-[11px] text-white/70 truncate shrink-0">
                {entry.strainName}
              </div>
              <div className="flex-1 bg-white/10 rounded-full h-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${entry.rate}%`,
                    backgroundColor: rateColor(entry.rate),
                  }}
                />
              </div>
              <div
                className="text-xs font-bold w-8 text-right shrink-0"
                style={{ color: rateColor(entry.rate) }}
              >
                {entry.rate}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SVG Line Chart (no recharts) ────────────────────────────────────────────

function HealthLineChart({ data }) {
  const VB_W = 300,
    VB_H = 120;
  const PAD = { l: 24, r: 8, t: 8, b: 22 };
  const cw = VB_W - PAD.l - PAD.r;
  const ch = VB_H - PAD.t - PAD.b;
  const n = data.length;
  const xOf = (i) => PAD.l + (n === 1 ? cw / 2 : (i / (n - 1)) * cw);
  const yOf = (v) => PAD.t + ch - ((v - 1) / 4) * ch;
  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.level)}`).join(" ");
  // Show at most 6 date labels evenly
  const labelStep = Math.max(1, Math.ceil(n / 6));

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full"
      style={{ height: 140 }}
    >
      {/* Grid lines */}
      {[1, 2, 3, 4, 5].map((v) => (
        <line
          key={v}
          x1={PAD.l}
          x2={VB_W - PAD.r}
          y1={yOf(v)}
          y2={yOf(v)}
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
      ))}
      {/* Y axis labels */}
      {[1, 3, 5].map((v) => (
        <text
          key={v}
          x={PAD.l - 4}
          y={yOf(v) + 3.5}
          textAnchor="end"
          fontSize="8"
          fill="rgba(235,235,245,0.3)"
        >
          {v}
        </text>
      ))}
      {/* Line */}
      <polyline
        points={pts}
        fill="none"
        stroke="#30d158"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Dots */}
      {data.map((d, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(d.level)} r="3" fill="#30d158" />
      ))}
      {/* X axis labels */}
      {data.map(
        (d, i) =>
          i % labelStep === 0 && (
            <text
              key={i}
              x={xOf(i)}
              y={VB_H - 4}
              textAnchor="middle"
              fontSize="8"
              fill="rgba(235,235,245,0.3)"
            >
              {d.date}
            </text>
          )
      )}
    </svg>
  );
}

// ─── Section B: Health Trends ─────────────────────────────────────────────────

function HealthTrendsSection({ mothers, getStrain }) {
  const activeMothers = useMemo(
    () => mothers.filter((m) => m.status === "Active"),
    [mothers]
  );
  const [selectedId, setSelectedId] = useState(null);

  const mother = useMemo(() => {
    const id = selectedId ?? activeMothers[0]?.id ?? null;
    return (
      activeMothers.find((m) => String(m.id) === String(id)) ??
      activeMothers[0] ??
      null
    );
  }, [selectedId, activeMothers]);

  const chartData = useMemo(() => {
    if (!mother) return [];
    return (mother.healthLog ?? [])
      .filter((e) => e.date && e.level != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({ date: fmtDate(e.date), level: e.level }));
  }, [mother]);

  if (activeMothers.length === 0) {
    return (
      <div className="mb-7">
        <SectionLabel>Health Trends</SectionLabel>
        <div className="text-white/30 text-sm text-center py-4">
          No active mothers.
        </div>
      </div>
    );
  }

  return (
    <div className="mb-7">
      <SectionLabel>Health Trends</SectionLabel>

      {/* Plant picker */}
      <select
        value={mother ? String(mother.id) : ""}
        onChange={(e) => setSelectedId(e.target.value)}
        className={`${selectCls} mb-3`}
      >
        {activeMothers.map((m) => (
          <option key={m.id} value={String(m.id)}>
            {getStrain(m.strainCode)?.name ?? m.strainCode} —{" "}
            {m.location || "No location"}
          </option>
        ))}
      </select>

      <div className="bg-[#1c1c1e] border border-white/10 rounded-xl p-4">
        {chartData.length < 2 ? (
          <div className="text-white/30 text-xs text-center py-6">
            Health trend starts recording from today — check back after a few
            updates.
          </div>
        ) : (
          <HealthLineChart data={chartData} />
        )}
      </div>
    </div>
  );
}

// ─── Section C: Strain Comparison ────────────────────────────────────────────

function StrainComparisonSection({ mothers, getStrain }) {
  const [sortKey, setSortKey] = useState("avgHealth");
  const [trays, setTrays] = useState([]);

  useEffect(() => {
    loadFromDB("clone_trays_v1").then((data) => {
      if (data) setTrays(data);
    });
  }, []);

  const trayRateMap = useMemo(() => {
    const { byStrain } = calcTrayRates(trays);
    return Object.fromEntries(byStrain.map((s) => [s.strainCode, s]));
  }, [trays]);

  const rows = useMemo(() => {
    const data = calcStrainComparison(mothers, getStrain).map((row) => {
      const trayData = trayRateMap[row.strainCode];
      return {
        ...row,
        totalClones: trayData ? trayData.count : row.totalClones,
        rootingRate: trayData ? trayData.rate : -1,
      };
    });
    return [...data].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [mothers, getStrain, sortKey, trayRateMap]);

  const headers = [
    { key: "avgHealth", label: "Health" },
    { key: "totalClones", label: "Clones" },
    { key: "rootingRate", label: "Surv%" },
  ];

  return (
    <div className="mb-7">
      <SectionLabel>Strain Comparison</SectionLabel>
      {rows.length === 0 ? (
        <div className="text-white/30 text-sm text-center py-4">
          No data yet.
        </div>
      ) : (
        <div className="bg-[#1c1c1e] border border-white/10 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_52px_52px_52px] px-4 py-2 border-b border-white/10">
            <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Strain
            </div>
            {headers.map((h) => (
              <button
                key={h.key}
                onClick={() => setSortKey(h.key)}
                className={`text-[10px] font-semibold uppercase tracking-wider text-center transition-colors ${
                  sortKey === h.key ? "text-[#0a84ff]" : "text-white/40"
                }`}
              >
                {h.label}
                {sortKey === h.key ? " ↓" : ""}
              </button>
            ))}
          </div>
          {/* Data rows */}
          {rows.map((row, i) => (
            <div
              key={row.strainCode}
              className={`grid grid-cols-[1fr_52px_52px_52px] px-4 py-3 ${
                i < rows.length - 1 ? "border-b border-white/10" : ""
              }`}
            >
              <div className="text-sm text-white/70 font-medium">
                {row.strainName}
              </div>
              <div
                className="text-sm font-bold text-center"
                style={{ color: healthColor(row.avgHealth) }}
              >
                {row.avgHealth.toFixed(1)}
              </div>
              <div className="text-sm text-white/60 text-center">
                {row.totalClones}
              </div>
              <div
                className="text-sm font-bold text-center"
                style={{
                  color:
                    row.rootingRate >= 0
                      ? rateColor(row.rootingRate)
                      : "rgba(235,235,245,0.3)",
                }}
              >
                {row.rootingRate >= 0 ? `${row.rootingRate}%` : "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main StatsTab export ─────────────────────────────────────────────────────

export default function StatsTab({ mothers, getStrain }) {
  return (
    <div className="px-4 py-4 pb-8 overflow-y-auto flex-1">
      <CloneRatesSection />
      <HealthTrendsSection mothers={mothers} getStrain={getStrain} />
      <StrainComparisonSection mothers={mothers} getStrain={getStrain} />
    </div>
  );
}
