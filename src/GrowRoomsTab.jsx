import { useState, useEffect, useRef, memo, useCallback } from "react";
import { loadFromDB, saveToDB, subscribeToKey } from "./supabase";
import {
  STRAINS,
  getStrain,
  SegmentedControl,
  Modal,
  SectionLabel,
  selectCls,
} from "./shared";

// ── Constants ────────────────────────────────────────────────────────────────
const BEDS = [
  { id: 1, label: "Bed 1" },
  { id: 2, label: "Bed 2" },
  { id: 3, label: "Bed 3" },
];
const SPOTS_PER_BED = 7;
const ROOM_TABS = ["Room 3", "Room 4", "Room 5"];
const ROOM_KEYS = { "Room 3": "room3", "Room 4": "room4", "Room 5": "room5" };
const DEFAULT_STATE = { room3: {}, room4: {}, room5: {} };

function squareKey(bed, spot) {
  return `B${bed}-S${spot}`;
}

// Perimeter = outer ring of the 3×7 grid (top bed, bottom bed, ends of middle bed)
function isPerimeter(bed, spot) {
  return (
    bed === 1 || bed === BEDS.length || spot === 1 || spot === SPOTS_PER_BED
  );
}

function normTs(ts) {
  try {
    return ts ? new Date(ts).toISOString() : null;
  } catch {
    return ts;
  }
}

// ── SquareCell ───────────────────────────────────────────────────────────────
const SquareCell = memo(function SquareCell({ bed, spot, data, onClick }) {
  const perim = isPerimeter(bed, spot);
  const filled = Boolean(data?.strainCode);

  if (!filled) {
    return (
      <button
        onClick={onClick}
        className={`aspect-square rounded-lg border border-dashed flex items-center justify-center w-full transition-colors ${
          perim
            ? "border-[#ffd60a]/25 bg-[#ffd60a]/[0.04] active:bg-[#ffd60a]/10"
            : "border-white/15 active:bg-white/5"
        }`}
      >
        <span className="text-white/25 text-sm leading-none">+</span>
      </button>
    );
  }

  const strain = getStrain(data.strainCode);

  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-lg border border-[#0a84ff]/30 bg-[#0a84ff]/10 flex flex-col items-center justify-center gap-[3px] p-0.5 w-full relative active:bg-[#0a84ff]/20 transition-colors"
    >
      <span className="text-[10px] font-bold text-[#0a84ff] leading-none truncate max-w-full px-0.5">
        {strain.code}
      </span>
      <div className="flex items-center gap-[3px]">
        <div
          className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${
            data.pot === "green" ? "bg-[#30d158]" : "bg-[#636366]"
          }`}
        />
        {data.amount > 0 && (
          <span className="text-[8px] text-white/40 leading-none">
            ×{data.amount}
          </span>
        )}
      </div>
      {perim && data.testers > 0 && (
        <span className="absolute top-0.5 right-0.5 text-[7px] font-bold text-[#ffd60a] leading-none">
          T{data.testers}
        </span>
      )}
    </button>
  );
});

// ── SquareSheet ──────────────────────────────────────────────────────────────
function SquareSheet({ bed, spot, data, onSave, onClear, onClose }) {
  const perim = isPerimeter(bed, spot);
  const [strainCode, setStrainCode] = useState(data?.strainCode || "");
  const [amount, setAmount] = useState(data?.amount ?? 1);
  const [pot, setPot] = useState(data?.pot || "green");
  const [testers, setTesters] = useState(data?.testers ?? 0);

  const filled = Boolean(data?.strainCode);

  function handleSave() {
    if (!strainCode) return;
    onSave({ strainCode, amount, pot, testers: perim ? testers : 0 });
    onClose();
  }

  return (
    <Modal title={`Bed ${bed} · Spot ${spot}`} onClose={onClose}>
      <div className="space-y-5">
        {/* Strain */}
        <div>
          <SectionLabel>Strain</SectionLabel>
          <select
            className={selectCls + " w-full"}
            value={strainCode}
            onChange={(e) => setStrainCode(e.target.value)}
          >
            <option value="">Select strain…</option>
            {STRAINS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} – {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Plant count */}
        <div>
          <SectionLabel>Plants</SectionLabel>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAmount((v) => Math.max(0, v - 1))}
              className="w-10 h-10 rounded-xl border border-white/10 text-white/60 text-lg font-bold active:bg-white/5 flex items-center justify-center flex-shrink-0"
            >
              −
            </button>
            <span className="text-2xl font-bold text-white min-w-[2ch] text-center">
              {amount}
            </span>
            <button
              onClick={() => setAmount((v) => v + 1)}
              className="w-10 h-10 rounded-xl border border-white/10 text-white/60 text-lg font-bold active:bg-white/5 flex items-center justify-center flex-shrink-0"
            >
              +
            </button>
          </div>
        </div>

        {/* Pot type */}
        <div>
          <SectionLabel>Pot</SectionLabel>
          <div className="flex gap-2">
            <button
              onClick={() => setPot("green")}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center gap-2 ${
                pot === "green"
                  ? "border-[#30d158]/50 bg-[#30d158]/15 text-[#30d158]"
                  : "border-white/10 text-white/40 active:bg-white/5"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-[#30d158] flex-shrink-0" />
              Green
            </button>
            <button
              onClick={() => setPot("black")}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center gap-2 ${
                pot === "black"
                  ? "border-[#636366]/60 bg-[#636366]/15 text-white/80"
                  : "border-white/10 text-white/40 active:bg-white/5"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-[#636366] flex-shrink-0" />
              Black
            </button>
          </div>
        </div>

        {/* Tester plants — perimeter squares only */}
        {perim && (
          <div>
            <SectionLabel>Tester Plants</SectionLabel>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setTesters((v) => Math.max(0, v - 1))}
                className="w-10 h-10 rounded-xl border border-white/10 text-white/60 text-lg font-bold active:bg-white/5 flex items-center justify-center flex-shrink-0"
              >
                −
              </button>
              <span className="text-2xl font-bold text-[#ffd60a] min-w-[2ch] text-center">
                {testers}
              </span>
              <button
                onClick={() => setTesters((v) => Math.min(3, v + 1))}
                className="w-10 h-10 rounded-xl border border-white/10 text-white/60 text-lg font-bold active:bg-white/5 flex items-center justify-center flex-shrink-0"
              >
                +
              </button>
              <span className="text-xs text-white/25">max 3, outside edge</span>
            </div>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!strainCode}
          className="w-full py-3 rounded-xl bg-[#0a84ff] text-white text-sm font-semibold disabled:opacity-40 active:bg-[#0a6fd6] transition-colors min-h-[44px]"
        >
          {filled ? "Update Square" : "Plant Square"}
        </button>

        {/* Clear */}
        {filled && (
          <button
            onClick={() => {
              onClear();
              onClose();
            }}
            className="w-full py-3 rounded-xl border border-white/10 text-white/40 text-sm active:border-[#ff453a]/30 active:text-[#ff453a] transition-colors min-h-[44px]"
          >
            Clear Square
          </button>
        )}
      </div>
    </Modal>
  );
}

// ── GrowRoomsTab ─────────────────────────────────────────────────────────────
export default function GrowRoomsTab() {
  const [activeRoom, setActiveRoom] = useState("Room 3");
  const [roomsData, setRoomsData] = useState(DEFAULT_STATE);
  const [activeSquare, setActiveSquare] = useState(null); // { bed, spot }
  const [loading, setLoading] = useState(true);

  const saveReadyRef = useRef(false);
  const timerRef = useRef(null);
  const pendingRef = useRef(new Set());

  // Load
  useEffect(() => {
    async function init() {
      const stored = await loadFromDB("rooms_v1");
      if (stored) setRoomsData({ ...DEFAULT_STATE, ...stored });
      saveReadyRef.current = true;
      setLoading(false);
    }
    init();
  }, []);

  // Subscribe
  useEffect(() => {
    const sub = subscribeToKey("rooms_v1", (value, updatedAt) => {
      if (pendingRef.current.has(normTs(updatedAt))) return;
      if (value) setRoomsData({ ...DEFAULT_STATE, ...value });
    });
    return () => sub.unsubscribe();
  }, []);

  // Save (debounced 600ms)
  useEffect(() => {
    if (!saveReadyRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const ts = new Date().toISOString();
      pendingRef.current.add(ts);
      saveToDB("rooms_v1", roomsData, ts)
        .catch(console.error)
        .finally(() => setTimeout(() => pendingRef.current.delete(ts), 3000));
    }, 600);
  }, [roomsData]);

  const roomKey = ROOM_KEYS[activeRoom];
  const currentRoom = roomsData[roomKey] || {};

  const handleCellClick = useCallback((bed, spot) => {
    setActiveSquare({ bed, spot });
  }, []);

  function updateSquare(bed, spot, data) {
    const key = squareKey(bed, spot);
    setRoomsData((prev) => ({
      ...prev,
      [roomKey]: { ...prev[roomKey], [key]: data },
    }));
  }

  function clearSquare(bed, spot) {
    const key = squareKey(bed, spot);
    setRoomsData((prev) => {
      const room = { ...prev[roomKey] };
      delete room[key];
      return { ...prev, [roomKey]: room };
    });
  }

  const activeSquareData = activeSquare
    ? currentRoom[squareKey(activeSquare.bed, activeSquare.spot)]
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-[#0a84ff] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <SegmentedControl
        options={ROOM_TABS}
        value={activeRoom}
        onChange={setActiveRoom}
      />

      <div className="space-y-5">
        {BEDS.map((bed) => {
          const isEdgeBed = bed.id === 1 || bed.id === BEDS.length;
          return (
            <div key={bed.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-white/50">
                  {bed.label}
                </span>
                {isEdgeBed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#ffd60a]/30 bg-[#1c1c1e] text-[#ffd60a]/60">
                    perimeter
                  </span>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: SPOTS_PER_BED }, (_, i) => {
                  const spot = i + 1;
                  const key = squareKey(bed.id, spot);
                  return (
                    <SquareCell
                      key={key}
                      bed={bed.id}
                      spot={spot}
                      data={currentRoom[key]}
                      onClick={() => handleCellClick(bed.id, spot)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 pt-2 border-t border-white/10 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-[#0a84ff]/30 bg-[#0a84ff]/10" />
          <span className="text-[10px] text-white/30">Planted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-dashed border-[#ffd60a]/25 bg-[#ffd60a]/[0.04]" />
          <span className="text-[10px] text-white/30">Perimeter</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#30d158]" />
          <span className="text-[10px] text-white/30">Green pot</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#636366]" />
          <span className="text-[10px] text-white/30">Black pot</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-[#ffd60a]">T2</span>
          <span className="text-[10px] text-white/30">Testers</span>
        </div>
      </div>

      {activeSquare && (
        <SquareSheet
          bed={activeSquare.bed}
          spot={activeSquare.spot}
          data={activeSquareData}
          onSave={(data) =>
            updateSquare(activeSquare.bed, activeSquare.spot, data)
          }
          onClear={() => clearSquare(activeSquare.bed, activeSquare.spot)}
          onClose={() => setActiveSquare(null)}
        />
      )}
    </div>
  );
}
