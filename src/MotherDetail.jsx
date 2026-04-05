import { useState, useMemo, useRef, memo } from "react";
import {
  getStrain, currentContainer, currentTransplantDate, daysSince, daysInVeg,
  today, fmtDate, uid, lastFeedingDate,
  healthColor, healthBg, healthLabel, statusBadgeColor, vegDaysColor,
  CONTAINERS, COMMON_AMENDMENTS, FEEDING_TYPES, DETAIL_TABS, TYPE_META, MOTHER_STATUSES,
  inputCls, selectCls, btnPrimary, btnSecondary,
  Badge, Modal, StatBox, SectionLabel, FormField, HealthDots, ContainerBadge,
  compressImage,
} from "./shared";

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
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonString).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    } else {
      try {
        const ta = document.createElement("textarea");
        ta.value = jsonString;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // execCommand also unavailable — nothing to do
      }
    }
  }

  return (
    <Modal title="Send to Clone Log" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-[#2a1f00]/20 border border-[#3a2e00] rounded-xl px-4 py-3">
          <div className="text-xs text-amber-300 font-semibold mb-1">Export Summary</div>
          <div className="text-sm text-[#f5f5f0] font-bold">{exportData.qty} clones of {strainName}</div>
          <div className="text-xs text-[#c5b08a] mt-0.5">Dated {fmtDate(cloneEntry.date)}</div>
          {motherLocation && <div className="text-xs text-[#6a5a3a] mt-0.5">Location: {motherLocation}</div>}
        </div>

        <div>
          <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider mb-2">JSON Package</div>
          <pre className="bg-[#1a1a1a] border border-[#2a2418] rounded-xl p-3 text-[10px] text-[#c5b08a] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {jsonString}
          </pre>
        </div>

        <button
          onClick={handleCopy}
          className={`w-full font-semibold text-sm rounded-xl py-3 transition-colors ${
            copied
              ? "bg-[#2a1f00] text-amber-200 border border-[#3a2e00]"
              : "bg-amber-600 hover:bg-amber-500 text-[#f5f5f0]"
          }`}
        >
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>

        <div className="bg-[#1a1a1a] border border-[#2a2418]/50 rounded-xl px-4 py-3 space-y-1.5">
          <div className="text-[10px] text-[#6a5a3a] uppercase tracking-wider font-semibold">How to import</div>
          <div className="flex items-start gap-2 text-xs text-[#c5b08a]">
            <span className="text-sky-400 font-bold flex-shrink-0">1.</span>
            <span>Open the <span className="text-[#f5f5f0] font-medium">Clone Log</span> app</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-[#c5b08a]">
            <span className="text-sky-400 font-bold flex-shrink-0">2.</span>
            <span>Go to the <span className="text-[#f5f5f0] font-medium">Add Entry</span> tab</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-[#c5b08a]">
            <span className="text-sky-400 font-bold flex-shrink-0">3.</span>
            <span>Tap <span className="text-[#f5f5f0] font-medium">Import from Mother Log</span> and paste</span>
          </div>
        </div>

        <button onClick={onClose} className={btnSecondary}>Done</button>
      </div>
    </Modal>
  );
}

// ── Photos Tab ─────────────────────────────────────────────────────────────
function PhotosTab({ mother, onAddPhoto, onRemovePhoto }) {
  const rawPhotos = mother.photos || [];
  const photos = useMemo(() => [...rawPhotos].sort((a, b) => b.id.localeCompare(a.id)), [rawPhotos]);
  const fileInputRef = useRef(null);
  const [adding, setAdding] = useState(false);
  const [caption, setCaption] = useState("");
  const [photoDate, setPhotoDate] = useState(today());
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fullscreen, setFullscreen] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());

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

  function togglePhotoSelect(id) {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else if (next.size < 2) { next.add(id); }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {storageWarning && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3">
          <div className="text-xs text-red-300 font-semibold">Storage Full</div>
          <div className="text-xs text-red-400/80 mt-0.5">Could not save photo. Delete some existing photos to free up space.</div>
        </div>
      )}

      {photos.length >= 2 && (
        <div className="flex justify-end">
          <button
            onClick={() => { setCompareMode(p => !p); setSelectedPhotos(new Set()); }}
            className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition-colors min-h-[44px] ${compareMode ? "bg-[#2a2418] text-[#f5f5f0] border-[#2a2418]" : "bg-[#111111]/80 border-[#2a2418] text-[#6a5a3a]"}`}
          >
            Compare
          </button>
        </div>
      )}

      {compareMode && selectedPhotos.size === 2 && (() => {
        const [idA, idB] = [...selectedPhotos];
        const pA = photos.find(p => p.id === idA);
        const pB = photos.find(p => p.id === idB);
        if (!pA || !pB) return null;
        return (
          <div className="grid grid-cols-2 gap-2">
            {[pA, pB].map(p => (
              <div key={p.id} className="rounded-xl overflow-hidden bg-[#111111] border border-[#2a2418]">
                <div className="w-full aspect-square">
                  <img src={p.dataUrl} alt={p.caption || "Photo"} className="w-full h-full object-cover" />
                </div>
                <div className="px-2 py-1.5">
                  {p.caption && <div className="text-[10px] text-[#c5b08a] truncate">{p.caption}</div>}
                  {p.date && <div className="text-[10px] text-[#6a5a3a]">{fmtDate(p.date)}</div>}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {!adding ? (
        <button onClick={() => setAdding(true)} className={btnPrimary}>+ Add Photo</button>
      ) : (
        <div className="bg-[#1a1a1a]/60 border border-[#2a2418] rounded-xl p-4 space-y-3">
          <div className="text-xs text-[#c5b08a] font-medium mb-1">New Photo</div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="w-full border border-dashed border-[#6a5a3a] active:border-[#c5b08a] rounded-xl py-4 text-xs text-[#6a5a3a] active:text-[#c5b08a] transition-colors"
          >
            {previewUrl ? "Change Photo" : "Tap to Select Photo"}
          </button>
          {previewUrl && (
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-[#111111] border border-[#2a2418]">
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
            <button onClick={handleSavePhoto} className={btnPrimary} disabled={!selectedFile || uploading}>
              {uploading ? "Saving..." : "Save Photo"}
            </button>
          </div>
        </div>
      )}

      {photos.length === 0 && !adding ? (
        <div className="text-center py-8 text-[#6a5a3a] text-sm">No photos yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map(p => {
            const isSelected = selectedPhotos.has(p.id);
            return (
              <button
                key={p.id}
                aria-label={p.caption || "View photo"}
                onClick={() => compareMode ? togglePhotoSelect(p.id) : setFullscreen(p)}
                className={`rounded-xl overflow-hidden bg-[#111111] border transition-colors text-left ${
                  compareMode && isSelected ? "border-amber-500 ring-1 ring-amber-500" :
                  compareMode ? "border-[#2a2418] active:border-[#6a5a3a]" :
                  "border-[#2a2418] active:border-[#6a5a3a]"
                }`}
              >
                <div className="w-full aspect-square relative">
                  <img src={p.dataUrl} alt={p.caption || "Photo"} className="w-full h-full object-cover" />
                  {compareMode && isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <span className="text-[#f5f5f0] text-[10px] font-bold">{[...selectedPhotos].indexOf(p.id) + 1}</span>
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  {p.date && <div className="text-[10px] text-[#6a5a3a]">{fmtDate(p.date)}</div>}
                  {p.caption && <div className="text-[10px] text-[#c5b08a] truncate">{p.caption}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {fullscreen && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center"
          onClick={() => setFullscreen(null)}
        >
          <div className="w-full max-w-md px-4 space-y-3" onClick={e => e.stopPropagation()}>
            <img src={fullscreen.dataUrl} alt={fullscreen.caption || "Photo"} className="w-full rounded-xl object-contain max-h-[65vh]" />
            {fullscreen.caption && <div className="text-sm text-[#f5f5f0] text-center">{fullscreen.caption}</div>}
            {fullscreen.date && <div className="text-xs text-[#6a5a3a] text-center">{fmtDate(fullscreen.date)}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setFullscreen(null)} className={btnSecondary}>Close</button>
              <button
                onClick={() => { onRemovePhoto(fullscreen.id); setFullscreen(null); }}
                className="flex-1 bg-red-900/40 hover:bg-red-900/60 active:bg-red-900/70 border border-red-800/50 text-red-400 font-medium text-sm rounded-xl py-2.5 transition-colors"
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

// ── Mother Detail Modal (default export) ──────────────────────────────────
const MotherDetailModal = memo(function MotherDetailModal({
  mother, detailTab, setDetailTab, onClose, onUpdate, onDelete, onPrintLabel,
  onAddTransplant, onRemoveTransplant,
  onAddAmendment, onRemoveAmendment,
  onAddCloneEntry, onRemoveCloneEntry,
  onAddFeedingEntry, onRemoveFeedingEntry,
  onAddReductionEntry, onRemoveReductionEntry,
  onAddPhoto, onRemovePhoto,
  onUpdateCloneOutcome,
}) {
  const s = getStrain(mother.strainCode);
  const container = currentContainer(mother);
  const txDate = currentTransplantDate(mother);
  const daysInContainer = daysSince(txDate);
  const totalClones = mother.cloneLog.reduce((a, c) => a + (parseInt(c.count) || 0), 0);
  const vegDays = daysInVeg(mother);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState(mother.notes || "");
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingHealth, setEditingHealth] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationVal, setLocationVal] = useState(mother.location || "");
  const [sendToCloneEntry, setSendToCloneEntry] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null);

  const [showTransplantModal, setShowTransplantModal] = useState(false);
  const [transplantForm, setTransplantForm] = useState({ container: "Black Pot", date: today(), dateUnknown: false });
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendForm, setAmendForm] = useState({ date: today(), amendment: "", notes: "" });
  const [amendSearch, setAmendSearch] = useState("");
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneForm, setCloneForm] = useState({ date: today(), count: "", notes: "" });
  const [showFeedingModal, setShowFeedingModal] = useState(false);
  const [feedingForm, setFeedingForm] = useState({ date: today(), type: "Water Only", notes: "" });
  const [showReductionModal, setShowReductionModal] = useState(false);
  const [reductionForm, setReductionForm] = useState({ date: today(), reason: "Space", notes: "" });

  const feedingLog = mother.feedingLog || [];
  const lastFed = lastFeedingDate(feedingLog);
  const daysSinceFed = daysSince(lastFed);

  const timeline = useMemo(() => [
    ...[...mother.transplantHistory].map(e => ({ ...e, _type: "transplant" })),
    ...(mother.amendmentLog || []).map(e => ({ ...e, _type: "amendment" })),
    ...(mother.feedingLog || []).map(e => ({ ...e, _type: "feeding" })),
    ...(mother.cloneLog || []).map(e => ({ ...e, _type: "clone" })),
    ...(mother.reductionLog || []).map(e => ({ ...e, _type: "reduction" })),
  ].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  }), [mother.transplantHistory, mother.amendmentLog, mother.feedingLog, mother.cloneLog, mother.reductionLog]);

  return (
    <>
      <Modal title={`${s.code} – ${s.name}`} onClose={onClose}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Badge label={mother.status} colorClass={statusBadgeColor(mother.status)} />
          <Badge label={healthLabel(mother.healthLevel)} colorClass={healthBg(mother.healthLevel)} />
          {mother.location && <span className="text-xs text-[#6a5a3a]">{mother.location}</span>}
        </div>

        <div className="flex gap-1 bg-[#111111] border border-[#2a2418] rounded-xl p-1 mb-4 overflow-x-auto">
          {DETAIL_TABS.map(t => (
            <button key={t} onClick={() => setDetailTab(t)} className={`flex-shrink-0 text-[10px] font-bold py-2 px-3 min-h-[44px] flex items-center rounded-lg transition-colors ${detailTab === t ? "bg-[#2a1f00] text-amber-300 border border-[#3a2e00]" : "text-[#6a5a3a] hover:text-[#c5b08a] active:text-[#c5b08a]"}`}>
              {t}
            </button>
          ))}
        </div>

        {detailTab === "Overview" && (() => {
          const cloneEntries = mother.cloneLog || [];
          const resolved = cloneEntries.filter(c => c.outcome === "rooted" || c.outcome === "failed");
          const rooted = resolved.filter(c => c.outcome === "rooted").reduce((a, c) => a + (parseInt(c.count) || 0), 0);
          const totalResolved = resolved.reduce((a, c) => a + (parseInt(c.count) || 0), 0);
          const rootRate = totalResolved > 0 ? Math.round((rooted / totalResolved) * 100) : null;
          const rootRateCls = rootRate === null ? "text-[#6a5a3a]" : rootRate >= 70 ? "text-emerald-400" : rootRate >= 40 ? "text-yellow-400" : "text-red-400";
          return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Days in Container" value={txDate ? (daysInContainer ?? "—") : "Unknown"} colorClass={txDate ? "text-sky-400" : "text-[#6a5a3a]"} />
              <StatBox label="Days in Veg" value={vegDays ?? "—"} colorClass={vegDaysColor(vegDays)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="Total Clones" value={totalClones} colorClass="text-emerald-400" />
              <StatBox label="Amendments" value={(mother.amendmentLog || []).length} colorClass="text-violet-400" />
              <StatBox label="Root Rate" value={rootRate !== null ? rootRate + "%" : "—"} colorClass={rootRateCls} />
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-3">
              <SectionLabel>Current Container</SectionLabel>
              {container ? <ContainerBadge container={container} /> : <span className="text-xs text-[#6a5a3a]">No transplant recorded</span>}
              {container && <div className="text-[10px] text-[#6a5a3a] mt-1">{txDate ? `Since ${fmtDate(txDate)}` : "Date unknown"}</div>}
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Health Level</SectionLabel>
                <button onClick={() => setEditingHealth(!editingHealth)} className="text-[10px] text-[#6a5a3a] hover:text-[#c5b08a] active:text-[#c5b08a] min-h-[44px] px-2 flex items-center">Edit</button>
              </div>
              {editingHealth ? (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button key={i} onClick={() => { onUpdate({ healthLevel: i }); setEditingHealth(false); }} className={`flex-1 h-8 rounded-xl border font-bold text-sm transition-colors ${mother.healthLevel === i ? i <= 2 ? "bg-red-900/60 border-red-700 text-red-300" : i === 3 ? "bg-yellow-900/60 border-yellow-700 text-yellow-300" : "bg-emerald-900/60 border-emerald-700 text-emerald-300" : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"}`}>
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
            <div className="bg-[#1a1a1a] rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Status</SectionLabel>
                <button onClick={() => setEditingStatus(!editingStatus)} className="text-[10px] text-[#6a5a3a] hover:text-[#c5b08a] active:text-[#c5b08a] min-h-[44px] px-2 flex items-center">Edit</button>
              </div>
              {editingStatus ? (
                <div className="flex gap-2">
                  {MOTHER_STATUSES.map(st => (
                    <button key={st} onClick={() => { onUpdate({ status: st }); setEditingStatus(false); }} className={`flex-1 text-xs py-1.5 rounded-xl border font-medium transition-colors min-h-[44px] ${statusBadgeColor(st)}`}>
                      {st}
                    </button>
                  ))}
                </div>
              ) : (
                <Badge label={mother.status} colorClass={statusBadgeColor(mother.status)} />
              )}
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <SectionLabel>VEG Room Location</SectionLabel>
                <button onClick={() => { setEditingLocation(!editingLocation); setLocationVal(mother.location || ""); }} className="text-[10px] text-[#6a5a3a] hover:text-[#c5b08a] active:text-[#c5b08a] min-h-[44px] px-2 flex items-center">Edit</button>
              </div>
              {editingLocation ? (
                <div className="flex gap-2">
                  <input type="text" className={inputCls + " flex-1"} placeholder="e.g. Row 2, Spot 4" value={locationVal} onChange={e => setLocationVal(e.target.value)} />
                  <button onClick={() => { onUpdate({ location: locationVal }); setEditingLocation(false); }} className="bg-amber-600 text-[#0a0a0a] text-xs px-3 rounded-xl min-h-[44px]">Save</button>
                </div>
              ) : (
                <span className="text-sm text-[#c5b08a]">{mother.location || <span className="text-[#6a5a3a]">Not set</span>}</span>
              )}
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <SectionLabel>Notes / Observations</SectionLabel>
                <button onClick={() => { setEditingNotes(!editingNotes); setNotesVal(mother.notes || ""); }} className="text-[10px] text-[#6a5a3a] hover:text-[#c5b08a] active:text-[#c5b08a] min-h-[44px] px-2 flex items-center">Edit</button>
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea className={inputCls + " resize-none"} rows={3} value={notesVal} onChange={e => setNotesVal(e.target.value)} />
                  <button onClick={() => { onUpdate({ notes: notesVal }); setEditingNotes(false); }} className={btnPrimary}>Save Notes</button>
                </div>
              ) : (
                <p className="text-sm text-[#c5b08a] whitespace-pre-wrap">{mother.notes || <span className="text-[#6a5a3a]">No notes yet.</span>}</p>
              )}
            </div>
            <button onClick={onPrintLabel} className="w-full border border-[#2a2418] text-[#c5b08a] active:text-[#f5f5f0] active:border-[#6a5a3a] text-xs rounded-xl py-2.5 transition-colors flex items-center justify-center gap-1.5 min-h-[44px]">
              Print Label
            </button>
            {confirmDelete ? (
              <div className="border border-red-800/60 rounded-xl p-3 space-y-2">
                <div className="text-xs text-red-400 text-center font-medium">Delete this mother plant? This cannot be undone.</div>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className={btnSecondary}>Cancel</button>
                  <button onClick={onDelete} className="flex-1 bg-red-800 hover:bg-red-700 active:bg-red-700 text-[#f5f5f0] font-semibold text-sm rounded-xl py-2.5 transition-colors min-h-[44px]">Delete</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="w-full border border-red-900/50 text-red-500 active:text-red-400 active:border-red-800 text-xs rounded-xl py-2.5 transition-colors min-h-[44px]">
                Delete Mother Plant
              </button>
            )}
          </div>
          );
        })()}

        {detailTab === "History" && (() => {
          const latestTxId = mother.transplantHistory.length ? mother.transplantHistory[mother.transplantHistory.length - 1].id : null;
          function entrySummary(e) {
            if (e._type === "transplant") return `→ ${e.container}`;
            if (e._type === "amendment") return e.amendment;
            if (e._type === "feeding") return e.type;
            if (e._type === "clone") return `${e.count} clone${parseInt(e.count) !== 1 ? "s" : ""} taken`;
            if (e._type === "reduction") return e.reason;
            return "";
          }
          function removeEntry(e) {
            if (e._type === "transplant") onRemoveTransplant(e.id);
            else if (e._type === "amendment") onRemoveAmendment(e.id);
            else if (e._type === "feeding") onRemoveFeedingEntry(e.id);
            else if (e._type === "clone") onRemoveCloneEntry(e.id);
            else if (e._type === "reduction") onRemoveReductionEntry(e.id);
          }
          return (
            <div className="space-y-3">
              <button onClick={() => setActiveSheet("picker")} className={btnPrimary}>＋ Add</button>
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-[#6a5a3a] text-sm">No history yet — tap + to log the first event.</div>
              ) : (
                <div className="bg-[#111111] border border-[#2a2418] rounded-2xl overflow-hidden">
                  {timeline.map(e => {
                    const meta = TYPE_META[e._type];
                    return (
                      <div key={`${e._type}-${e.id}`} className={`flex items-start gap-3 px-4 py-3 border-b border-[#2a2418] last:border-0 border-l-2 ${meta.border}`}>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${meta.text}`}>
                            {meta.label}{e._type === "transplant" && e.id === latestTxId ? " · Current" : ""}
                          </div>
                          <div className="text-sm text-[#f5f5f0] font-medium">{entrySummary(e)}</div>
                          {e.notes && <div className="text-xs text-[#6a5a3a] mt-0.5 truncate">{e.notes}</div>}
                          <div className="text-xs text-[#6a5a3a] mt-0.5">{e.date ? fmtDate(e.date) : "Date unknown"}</div>
                          {e._type === "clone" && (
                            <div className="mt-1.5 space-y-1.5">
                              <button
                                onClick={() => setSendToCloneEntry(e)}
                                className="text-xs text-sky-400 active:text-sky-300 border border-sky-800/50 active:border-sky-700 rounded-lg px-3 min-h-[44px] flex items-center transition-colors"
                              >
                                Send to Clone Log
                              </button>
                              {e.outcome == null ? (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => onUpdateCloneOutcome && onUpdateCloneOutcome(e.id, "rooted")}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-[#2a1f00] border border-[#3a2e00] text-amber-300 font-semibold active:bg-[#3a2e0a] transition-colors min-h-[44px] flex items-center"
                                  >
                                    Rooted
                                  </button>
                                  <button
                                    onClick={() => onUpdateCloneOutcome && onUpdateCloneOutcome(e.id, "failed")}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-red-900/50 border border-red-700/50 text-red-300 font-semibold active:bg-red-800 transition-colors min-h-[44px] flex items-center"
                                  >
                                    Failed
                                  </button>
                                </div>
                              ) : e.outcome === "rooted" ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-900/50 border border-emerald-700/50 text-emerald-300 font-semibold">Rooted</span>
                                  <button onClick={() => onUpdateCloneOutcome && onUpdateCloneOutcome(e.id, null)} className="text-[10px] text-[#6a5a3a] active:text-[#c5b08a] underline transition-colors min-h-[44px] px-2 flex items-center">Undo</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-red-900/50 border border-red-700/50 text-red-300 font-semibold">Failed</span>
                                  <button onClick={() => onUpdateCloneOutcome && onUpdateCloneOutcome(e.id, null)} className="text-[10px] text-[#6a5a3a] active:text-[#c5b08a] underline transition-colors min-h-[44px] px-2 flex items-center">Undo</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <button onClick={() => removeEntry(e)} aria-label="Remove entry" className="text-[#2a2418] hover:text-red-500 text-sm w-11 h-11 flex items-center justify-center rounded-lg transition-colors flex-shrink-0">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
              {activeSheet === "picker" && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setActiveSheet(null); }}>
                  <div className="bg-[#0f0f0f] border border-[#2a2418] rounded-t-3xl w-full max-w-md shadow-2xl">
                    <div className="flex justify-center pt-3 pb-1">
                      <div className="w-9 h-1 rounded-full bg-[#2a2418]" />
                    </div>
                    <div className="px-5 pb-6 pt-2 space-y-2">
                      <div className="text-sm font-bold text-[#f5f5f0] mb-3">What would you like to log?</div>
                      {[
                        { label: "Transplant", action: () => { setActiveSheet(null); setTransplantForm({ container: container || "Black Pot", date: today(), dateUnknown: false }); setShowTransplantModal(true); } },
                        { label: "Amendment",  action: () => { setActiveSheet(null); setAmendForm({ date: today(), amendment: "", notes: "" }); setAmendSearch(""); setShowAmendModal(true); } },
                        { label: "Clone Cut",  action: () => { setActiveSheet(null); setCloneForm({ date: today(), count: "", notes: "" }); setShowCloneModal(true); } },
                        { label: "Feeding",    action: () => { setActiveSheet(null); setFeedingForm({ date: today(), type: "Water Only", notes: "" }); setShowFeedingModal(true); } },
                        { label: "Reduction",  action: () => { setActiveSheet(null); setReductionForm({ date: today(), reason: "Space", notes: "" }); setShowReductionModal(true); } },
                      ].map(({ label, action }) => (
                        <button key={label} onClick={action} className="w-full text-left px-4 py-3 bg-[#1a1a1a] hover:bg-[#2a2418] active:bg-[#2a2418] rounded-xl text-sm text-[#f5f5f0] font-medium transition-colors min-h-[44px]">
                          {label}
                        </button>
                      ))}
                      <button onClick={() => setActiveSheet(null)} className="w-full py-2.5 mt-1 rounded-xl border border-[#2a2418] text-[#6a5a3a] text-sm font-semibold min-h-[44px] active:bg-[#1a1a1a] active:text-[#c5b08a] transition-colors">Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {detailTab === "Photos" && (
          <PhotosTab mother={mother} onAddPhoto={onAddPhoto} onRemovePhoto={onRemovePhoto} />
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
                      ? "bg-[#2a2418] border-[#6a5a3a] text-[#f5f5f0]"
                      : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${transplantForm.dateUnknown ? "bg-amber-600 border-amber-500" : "border-[#2a2418]"}`}>
                    {transplantForm.dateUnknown && <span className="text-[#f5f5f0] text-[10px]">✓</span>}
                  </span>
                  Date unknown
                </button>
                {!transplantForm.dateUnknown && (
                  <input type="date" className={inputCls} value={transplantForm.date} onChange={e => setTransplantForm(p => ({ ...p, date: e.target.value }))} />
                )}
              </div>
            </FormField>
            <button onClick={() => { onAddTransplant({ ...transplantForm, date: transplantForm.dateUnknown ? null : transplantForm.date }); setShowTransplantModal(false); }} className={btnPrimary}>Save Transplant</button>
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
                value={amendSearch !== "" ? amendSearch : amendForm.amendment}
                onChange={e => { setAmendSearch(e.target.value); setAmendForm(p => ({ ...p, amendment: e.target.value })); }}
                onFocus={() => { if (!amendSearch) setAmendSearch(amendForm.amendment || ""); }}
              />
              {amendSearch && (
                <div className="mt-1 bg-[#1a1a1a] border border-[#2a2418] rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                  {COMMON_AMENDMENTS.filter(a => a.toLowerCase().includes(amendSearch.toLowerCase())).map(a => (
                    <button key={a} className="w-full text-left px-3 py-2 text-xs text-[#c5b08a] hover:bg-[#2a2418] transition-colors" onClick={() => { setAmendForm(p => ({ ...p, amendment: a })); setAmendSearch(""); }}>
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
            <button onClick={() => { if (amendForm.amendment.trim()) { onAddAmendment(amendForm); setShowAmendModal(false); setAmendSearch(""); } }} className={btnPrimary} disabled={!amendForm.amendment.trim()}>
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
            <button onClick={() => { if (cloneForm.count) { onAddCloneEntry(cloneForm); setShowCloneModal(false); } }} className={btnPrimary} disabled={!cloneForm.count}>
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
            <button onClick={() => { onAddFeedingEntry(feedingForm); setShowFeedingModal(false); }} className={btnPrimary}>
              Save Feeding
            </button>
          </div>
        </Modal>
      )}

      {showReductionModal && (
        <Modal title="Log Reduction" onClose={() => setShowReductionModal(false)}>
          <div className="space-y-4">
            <FormField label="Reason">
              <div className="flex gap-2 flex-wrap">
                {["Space", "Sidelined", "Launchpad Prep", "Other"].map(r => (
                  <button key={r} onClick={() => setReductionForm(p => ({ ...p, reason: r }))}
                    className={`flex-1 text-xs py-2 rounded-xl font-medium border transition-colors ${reductionForm.reason === r ? "bg-amber-900/50 text-amber-300 border-amber-700/40" : "bg-[#1a1a1a] border-[#2a2418] text-[#6a5a3a]"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Date">
              <input type="date" className={inputCls} value={reductionForm.date} onChange={e => setReductionForm(p => ({ ...p, date: e.target.value }))} />
            </FormField>
            <FormField label="Notes (optional)">
              <input type="text" placeholder="What was cut, how much, etc." className={inputCls} value={reductionForm.notes} onChange={e => setReductionForm(p => ({ ...p, notes: e.target.value }))} />
            </FormField>
            <button onClick={() => { onAddReductionEntry(reductionForm); setShowReductionModal(false); }} className={btnPrimary}>
              Save Reduction
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
});

export default MotherDetailModal;
