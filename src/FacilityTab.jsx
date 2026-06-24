import { useState, memo } from "react";
import { inputCls, SectionLabel, GroupedList } from "./shared";

// ── Facility constants ──────────────────────────────────────────────────────
export const DEFAULT_FACILITY = {
  room2floor: { label: "Room 2 Floor", log: [] },
  bench1: { label: "Bench 1", log: [] },
  bench2: { label: "Bench 2", log: [] },
  bench3: { label: "Bench 3", log: [] },
  bench4: { label: "Bench 4", log: [] },
  ac_cleaned: { label: "A/C Cleaned", log: [] },
  ac_filters: { label: "Filters Replaced", log: [] },
};

export const FACILITY_SECTIONS = [
  { label: "Floor", items: ["room2floor"] },
  { label: "Benches", items: ["bench1", "bench2", "bench3", "bench4"] },
  { label: "A/C", items: ["ac_cleaned", "ac_filters"] },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function facilityDaysSince(ts) {
  if (!ts) return null;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
  );
}
function facilityBorderColor(days) {
  if (days === null) return "border-l-white/10";
  if (days <= 2) return "border-l-[#30d158]";
  if (days <= 7) return "border-l-[#ffd60a]";
  return "border-l-[#ff453a]";
}
function facilityAgeText(days) {
  if (days === null) return "Never logged";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
function facilityAgeColor(days) {
  if (days === null) return "text-white/30";
  if (days <= 2) return "text-[#30d158]";
  if (days <= 7) return "text-[#ffd60a]";
  return "text-[#ff453a]";
}

// ── FacilityItem ─────────────────────────────────────────────────────────────
const FacilityItem = memo(function FacilityItem({ itemKey, data, onLog }) {
  const lastEntry = (Array.isArray(data?.log) ? data.log[0] : null) ?? null;
  const days = facilityDaysSince(lastEntry?.ts ?? null);
  return (
    <div
      className={`bg-[#2c2c2e] border-l-2 ${facilityBorderColor(days)} px-4 py-3.5 flex items-center gap-3`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[17px] text-white/90 font-medium truncate">
          {data.label}
        </div>
        <div
          className={`text-[13px] font-medium mt-0.5 ${facilityAgeColor(days)}`}
        >
          {facilityAgeText(days)}
          {lastEntry && days !== 0 && (
            <span className="text-white/30 ml-1.5">
              ·{" "}
              {new Date(lastEntry.ts).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onLog(itemKey)}
        className="flex-shrink-0 py-2 px-4 rounded-xl bg-[#0a84ff]/10 border border-[#0a84ff]/20 text-[#0a84ff] text-[13px] font-semibold active:bg-[#0a84ff]/20 transition-colors min-h-[44px] flex items-center justify-center"
      >
        Log Now
      </button>
    </div>
  );
});

// ── FacilityTab ──────────────────────────────────────────────────────────────
export default function FacilityTab({ facility, onLog }) {
  const [logSheet, setLogSheet] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [toast, setToast] = useState(null);

  function openLog(key) {
    setLogSheet(key);
    setNoteInput("");
  }
  function closeLog() {
    setLogSheet(null);
    setNoteInput("");
  }
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1c1c1e] border border-white/10 text-[#30d158] text-sm font-semibold px-4 py-2 rounded-2xl shadow-xl pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
      {FACILITY_SECTIONS.map((section) => (
        <div key={section.label}>
          <SectionLabel>{section.label}</SectionLabel>
          <GroupedList>
            {section.items.map((key) => (
              <FacilityItem
                key={key}
                itemKey={key}
                data={facility[key] || DEFAULT_FACILITY[key]}
                onLog={openLog}
              />
            ))}
          </GroupedList>
        </div>
      ))}

      {logSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLog();
          }}
        >
          <div className="bg-[#1c1c1e] border border-white/10 rounded-t-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-6 pt-2 space-y-3">
              <div className="text-[17px] font-semibold text-white/90">
                {facility[logSheet]?.label ?? logSheet}
              </div>
              <input
                type="text"
                placeholder="Notes (optional)"
                className={inputCls}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={closeLog}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm font-semibold min-h-[44px] active:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLog}
                  className="flex-1 py-2.5 rounded-xl bg-[#0a84ff] active:bg-[#0a84ff]/80 text-white text-sm font-semibold transition-colors min-h-[44px]"
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
