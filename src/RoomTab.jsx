import { useState, useCallback, memo } from "react";
import { FlaskConical } from "lucide-react";
import {
  getStrain,
  COMMON_AMENDMENTS,
  inputCls, selectCls,
  Modal, SectionLabel, HealthDots,
  today,
} from "./shared";

// ── Room layout constants ───────────────────────────────────────────────────
const BENCHES = [
  { id: 1, label: "Bench 1", desc: "Mothers only",      accent: "amber", lower: true },
  { id: 2, label: "Bench 2", desc: "Mostly mothers",    accent: "sky" },
  { id: 3, label: "Bench 3", desc: "Mostly upcoming",   accent: "violet" },
  { id: 4, label: "Bench 4", desc: "Upcoming rounds",   accent: "indigo" },
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

// ── SpotCell ────────────────────────────────────────────────────────────────
const SpotCell = memo(function SpotCell({ bench, spot, spotMothers, isUpcoming, onCellClick }) {
  const type = spotMothers.length > 0 ? "mother" : isUpcoming ? "upcoming" : "empty";
  function handleClick() { onCellClick(bench, spot); }

  if (type === "mother") {
    const worst = worstHealth(spotMothers);
    const bgCls     = worst <= 2 ? "bg-red-950"     : worst === 3 ? "bg-amber-950"   : "bg-emerald-950";
    const borderCls = worst <= 2 ? "border-red-600"  : worst === 3 ? "border-yellow-600" : "border-green-600";
    const textCls   = worst <= 2 ? "text-red-300"    : worst === 3 ? "text-yellow-200"  : "text-green-200";
    const dotCls    = worst <= 2 ? "bg-red-400"      : worst === 3 ? "bg-yellow-400"    : "bg-emerald-400";
    const multi = spotMothers.length > 1;
    return (
      <button
        onClick={handleClick}
        className={`aspect-square rounded-lg border ${bgCls} ${borderCls} flex flex-col items-center justify-center gap-0.5 p-0.5 w-full`}
      >
        {multi ? (
          <>
            <span className={`text-[10px] font-bold leading-none ${textCls}`}>{spotMothers.length}x</span>
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
            <span className={`text-[10px] font-bold leading-none truncate max-w-full px-0.5 ${textCls}`}>{getStrain(spotMothers[0].strainCode).code}</span>
            <div className="flex gap-[2px] justify-center">
              {[1,2,3,4,5].map(i => (
                <div key={i} className={`w-1 h-1 rounded-full ${i <= spotMothers[0].healthLevel ? dotCls : "bg-[#2a2418]"}`} />
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
        <span className="text-[10px] font-bold text-indigo-300 leading-none">RND</span>
        <span className="text-[9px] text-indigo-500 leading-none">upcoming</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="aspect-square rounded-lg border border-dashed border-[#2a2418] flex items-center justify-center w-full active:border-[#6a5a3a] active:bg-[#111111]/40 transition-colors"
    >
      <span className="text-[#6a5a3a] text-sm leading-none">+</span>
    </button>
  );
});

// ── SpotSheet ───────────────────────────────────────────────────────────────
function SpotSheet({ bench, spot, spotMothers, isUpcoming, mothers, onClose, onSelectMother, onUpdateMother, onMarkUpcoming, onClearUpcoming, onAddAmendment }) {
  const key = locationKey(bench, spot);
  const [selectedMotherId, setSelectedMotherId] = useState("");
  const [showAmend, setShowAmend] = useState(false);
  const [amendSearch, setAmendSearch] = useState("");
  const [amendValue, setAmendValue] = useState("");
  const [amendNote, setAmendNote] = useState("");
  const [spotToast, setSpotToast] = useState(null);
  const unassigned = mothers.filter(m => !parseLocation(m.location) || m.location === key);

  function showSpotToast(msg) { setSpotToast(msg); setTimeout(() => setSpotToast(null), 2000); }

  function assignMother() {
    if (!selectedMotherId) return;
    onUpdateMother(selectedMotherId, { location: key });
    showSpotToast("Assigned to spot");
    setTimeout(onClose, 1200);
  }

  return (
    <Modal title={`Bench ${bench} · Spot ${spot}`} onClose={onClose}>
      {spotToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-[#2a1f00] border border-[#3a2e00] text-amber-200 text-sm font-semibold px-4 py-2 rounded-2xl shadow-xl pointer-events-none whitespace-nowrap">
          {spotToast}
        </div>
      )}
      <div className="space-y-4">
        {spotMothers.length > 0 && (
          <div>
            <SectionLabel>Plants in this spot</SectionLabel>
            {/* Quick action buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setShowAmend(p => !p)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-900/60 border border-violet-800/50 text-violet-300 text-xs font-semibold active:bg-violet-800 transition-colors min-h-[44px]"
              >
                <FlaskConical className="w-4 h-4" strokeWidth={2} />
                Amend
              </button>
            </div>
            {/* Inline amend form */}
            {showAmend && (
              <div className="bg-[#1a1a1a] border border-[#2a2418] rounded-xl p-3 space-y-2 mb-3">
                <div>
                  <input
                    type="text"
                    placeholder="Search or type amendment..."
                    className={inputCls}
                    value={amendValue || amendSearch}
                    onChange={e => { setAmendSearch(e.target.value); setAmendValue(e.target.value); }}
                    autoFocus
                  />
                  {amendSearch && (
                    <div className="mt-1 bg-[#1a1a1a] border border-[#2a2418] rounded-xl overflow-hidden max-h-32 overflow-y-auto">
                      {COMMON_AMENDMENTS.filter(a => a.toLowerCase().includes(amendSearch.toLowerCase())).map(a => (
                        <button key={a} className="w-full text-left px-3 py-2 text-xs text-[#c5b08a] hover:bg-[#222] active:bg-[#222] transition-colors" onClick={() => { setAmendValue(a); setAmendSearch(""); }}>
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
                  value={amendNote}
                  onChange={e => setAmendNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => { setShowAmend(false); setAmendSearch(""); setAmendValue(""); setAmendNote(""); }} className="flex-1 py-2.5 rounded-xl border border-[#2a2418] text-[#c5b08a] text-xs font-semibold min-h-[44px] active:bg-[#1a1a1a] active:text-[#c5b08a] transition-colors">Cancel</button>
                  <button
                    onClick={() => {
                      if (!amendValue.trim()) return;
                      spotMothers.forEach(m => onAddAmendment(m.id, { date: today(), amendment: amendValue.trim(), notes: amendNote.trim() }));
                      setShowAmend(false);
                      setAmendSearch("");
                      setAmendValue("");
                      setAmendNote("");
                      showSpotToast("Amendment logged");
                    }}
                    disabled={!amendValue.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-violet-700 text-[#f5f5f0] text-xs font-semibold disabled:opacity-40 active:bg-violet-600 transition-colors min-h-[44px]"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {spotMothers.map(m => {
                const s = getStrain(m.strainCode);
                return (
                  <div key={m.id} className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2418] rounded-xl px-3 py-2.5">
                    <button onClick={() => { onSelectMother(m); onClose(); }} className="flex-1 text-left">
                      <div className="text-sm font-bold text-amber-300">{s.code}</div>
                      <div className="text-[10px] text-[#c5b08a] mt-0.5">{s.name}</div>
                      <HealthDots level={m.healthLevel} />
                    </button>
                    <button
                      onClick={() => { onUpdateMother(m.id, { location: "" }); showSpotToast("Removed from spot"); }}
                      className="text-[#6a5a3a] active:text-red-400 text-xs ml-3 border border-[#2a2418] active:border-red-700/50 rounded-lg px-3 min-h-[44px] flex items-center transition-colors flex-shrink-0"
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
            <div className="text-xs text-[#c5b08a]">This spot is reserved for the next round.</div>
          </div>
        )}

        {isUpcoming && (
          <button onClick={() => { onClearUpcoming(key); onClose(); }} className="w-full border border-[#2a2418] text-[#c5b08a] active:text-[#f5f5f0] active:border-[#6a5a3a] text-xs rounded-xl py-2.5 transition-colors min-h-[44px]">
            Clear Upcoming Slot
          </button>
        )}

        {!isUpcoming && spotMothers.length === 0 && (
          <button onClick={() => { onMarkUpcoming(key); onClose(); }} className="w-full bg-indigo-900/30 border border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/50 active:bg-indigo-900/50 text-xs font-semibold rounded-xl py-2.5 transition-colors min-h-[44px]">
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
              className="bg-amber-600 hover:bg-amber-500 active:bg-amber-500 disabled:opacity-40 text-[#f5f5f0] text-xs font-semibold px-3 rounded-xl transition-colors flex-shrink-0 min-h-[44px]"
            >
              Assign
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── RoomTab ─────────────────────────────────────────────────────────────────
export default function RoomTab({ mothers, roomSpots, setRoomSpots, onSelectMother, onUpdateMother, onAddAmendment }) {
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
        <span className="text-[10px] text-[#6a5a3a] uppercase tracking-widest font-semibold">Entrance</span>
      </div>

      {BENCHES.map(bench => {
        const accentMap = {
          amber:  "text-amber-400 border-amber-800/40",
          sky:    "text-sky-400 border-sky-800/40",
          violet: "text-violet-400 border-violet-800/40",
          indigo: "text-indigo-400 border-indigo-800/40",
        };
        const accentCls = accentMap[bench.accent] || "text-[#c5b08a] border-[#2a2418]";

        return (
          <div key={bench.id} className={bench.lower ? "mt-2 ml-2" : ""}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold ${accentCls.split(" ")[0]}`}>{bench.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${accentCls} bg-[#111111]`}>{bench.desc}</span>
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

      <div className="flex items-center gap-3 pt-2 border-t border-[#2a2418]/60 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-green-600 bg-emerald-950" />
          <span className="text-[10px] text-[#6a5a3a]">Excellent/Good</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-yellow-600 bg-amber-950" />
          <span className="text-[10px] text-[#6a5a3a]">Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-red-600 bg-red-950" />
          <span className="text-[10px] text-[#6a5a3a]">Poor/Fair</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-indigo-700/50 bg-indigo-900/20" />
          <span className="text-[10px] text-[#6a5a3a]">Upcoming</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-dashed border border-[#2a2418]" />
          <span className="text-[10px] text-[#6a5a3a]">Empty</span>
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
          onAddAmendment={onAddAmendment}
        />
      )}
    </div>
  );
}
