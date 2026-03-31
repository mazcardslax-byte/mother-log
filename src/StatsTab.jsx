import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { calcCloneRates, calcStrainComparison, calcCareGaps } from "./stats-utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function rateColor(rate) {
  if (rate >= 75) return "#10b981";
  if (rate >= 50) return "#f59e0b";
  return "#ef4444";
}

function healthColor(h) {
  if (h >= 4.5) return "#10b981";
  if (h >= 3.5) return "#34d399";
  if (h >= 2.5) return "#f59e0b";
  return "#ef4444";
}

function daysBadgeColor(days) {
  if (days === Infinity || days === null || days === undefined) return "text-red-400 border-red-800";
  if (days > 10) return "text-red-400 border-red-800";
  if (days > 6) return "text-yellow-400 border-yellow-800";
  return "text-emerald-400 border-emerald-800";
}

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase mb-3">
      {children}
    </div>
  );
}

// ─── Section A: Clone Rooting Rates ──────────────────────────────────────────

function CloneRatesSection({ mothers, getStrain }) {
  const { overall, byStrain } = useMemo(
    () => calcCloneRates(mothers, getStrain),
    [mothers, getStrain]
  );

  return (
    <div className="mb-7">
      <SectionLabel>Clone Rooting Rates</SectionLabel>

      {/* Summary row */}
      <div className="flex gap-2 mb-4">
        {[
          { label: "Overall", value: overall.taken === 0 ? "—" : `${overall.rate}%`, color: overall.taken === 0 ? "text-zinc-400" : rateColor(overall.rate) },
          { label: "Total cuts", value: overall.taken, color: "text-zinc-200" },
          { label: "Rooted", value: overall.rooted, color: "text-zinc-200" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {byStrain.length === 0 ? (
        <div className="text-zinc-600 text-sm text-center py-4">No clone data yet.</div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={byStrain.length * 44 + 16}>
            <BarChart
              data={byStrain}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 4, bottom: 0 }}
              barSize={10}
            >
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#52525b", fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="strainName" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={90} />
              <Tooltip
                formatter={(value) => [`${value}%`, "Rooting rate"]}
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#e4e4e7" }}
              />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                {byStrain.map((entry) => (
                  <Cell key={entry.strainCode} fill={rateColor(entry.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Section B: Health Trends ─────────────────────────────────────────────────

function HealthTrendsSection({ mothers }) {
  const activeMothers = useMemo(() => mothers.filter(m => m.status === "Active"), [mothers]);
  const [selectedId, setSelectedId] = useState(null);

  const mother = useMemo(() => {
    const id = selectedId ?? activeMothers[0]?.id ?? null;
    return activeMothers.find(m => m.id === id) ?? activeMothers[0] ?? null;
  }, [selectedId, activeMothers]);

  const chartData = useMemo(() => {
    if (!mother) return [];
    return (mother.healthLog ?? [])
      .filter(e => e.date && e.level != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => ({ date: fmtDate(e.date), level: e.level }));
  }, [mother]);

  if (activeMothers.length === 0) {
    return (
      <div className="mb-7">
        <SectionLabel>Health Trends</SectionLabel>
        <div className="text-zinc-600 text-sm text-center py-4">No active mothers.</div>
      </div>
    );
  }

  return (
    <div className="mb-7">
      <SectionLabel>Health Trends</SectionLabel>

      {/* Plant picker */}
      <select
        value={mother?.id ?? ""}
        onChange={e => setSelectedId(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 mb-3 appearance-none"
      >
        {activeMothers.map(m => (
          <option key={m.id} value={m.id}>
            {m.strainCode} — {m.location || "No location"}
          </option>
        ))}
      </select>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        {chartData.length < 2 ? (
          <div className="text-zinc-600 text-xs text-center py-6">
            Health trend starts recording from today — check back after a few updates.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: "#52525b", fontSize: 10 }} />
              <Tooltip
                formatter={(value) => [value, "Health"]}
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#e4e4e7" }}
              />
              <Line
                type="monotone"
                dataKey="level"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Section C: Strain Comparison ────────────────────────────────────────────

function StrainComparisonSection({ mothers, getStrain }) {
  const [sortKey, setSortKey] = useState("avgHealth");

  const rows = useMemo(() => {
    const data = calcStrainComparison(mothers, getStrain);
    return [...data].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [mothers, getStrain, sortKey]);

  const headers = [
    { key: "avgHealth", label: "Health" },
    { key: "totalClones", label: "Clones" },
    { key: "rootingRate", label: "Root%" },
  ];

  return (
    <div className="mb-7">
      <SectionLabel>Strain Comparison</SectionLabel>
      {rows.length === 0 ? (
        <div className="text-zinc-600 text-sm text-center py-4">No data yet.</div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_52px_52px_52px] px-4 py-2 border-b border-zinc-800">
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Strain</div>
            {headers.map(h => (
              <button
                key={h.key}
                onClick={() => setSortKey(h.key)}
                className={`text-[10px] font-semibold uppercase tracking-wider text-center transition-colors ${
                  sortKey === h.key ? "text-emerald-400" : "text-zinc-600"
                }`}
              >
                {h.label}{sortKey === h.key ? " ↓" : ""}
              </button>
            ))}
          </div>
          {/* Data rows */}
          {rows.map((row, i) => (
            <div
              key={row.strainCode}
              className={`grid grid-cols-[1fr_52px_52px_52px] px-4 py-3 ${
                i < rows.length - 1 ? "border-b border-zinc-800/60" : ""
              }`}
            >
              <div className="text-sm text-zinc-300 font-medium">{row.strainName}</div>
              <div className="text-sm font-bold text-center" style={{ color: healthColor(row.avgHealth) }}>
                {row.avgHealth.toFixed(1)}
              </div>
              <div className="text-sm text-zinc-300 text-center">{row.totalClones}</div>
              <div className="text-sm font-bold text-center" style={{ color: rateColor(row.rootingRate) }}>
                {row.rootingRate > 0 ? `${row.rootingRate}%` : "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section D: Care Gaps ─────────────────────────────────────────────────────

function CareGapsSection({ mothers, getStrain }) {
  const gaps = useMemo(() => calcCareGaps(mothers, getStrain), [mothers, getStrain]);

  return (
    <div className="mb-7">
      <SectionLabel>Care Gaps — days since last water</SectionLabel>
      {gaps.length === 0 ? (
        <div className="text-zinc-600 text-sm text-center py-4">No active mothers.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {gaps.map(g => {
            const badge = daysBadgeColor(g.daysSinceNum);
            const days = g.daysSinceNum === Infinity ? "—" : `${g.daysSinceNum}d`;
            return (
              <div
                key={g.id}
                className={`bg-zinc-900 border rounded-xl px-4 py-3 flex items-center justify-between ${
                  g.daysSinceNum > 10 ? "border-red-900/60" : g.daysSinceNum > 6 ? "border-yellow-900/60" : "border-zinc-800"
                }`}
              >
                <div>
                  <div className="text-sm font-semibold text-zinc-200">{g.name} — {g.location || "No location"}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Last: {g.lastDate ? fmtDate(g.lastDate) : "Never"}
                  </div>
                </div>
                <div className={`text-base font-bold border rounded-lg px-2 py-1 ${badge}`}>
                  {days}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main StatsTab export ─────────────────────────────────────────────────────

export default function StatsTab({ mothers, getStrain }) {
  return (
    <div className="px-4 py-4 pb-8 overflow-y-auto flex-1">
      <CloneRatesSection mothers={mothers} getStrain={getStrain} />
      <HealthTrendsSection mothers={mothers} />
      <StrainComparisonSection mothers={mothers} getStrain={getStrain} />
      <CareGapsSection mothers={mothers} getStrain={getStrain} />
    </div>
  );
}
