// src/dry-room-utils.js

export const DRY_DAYS = 15;

/**
 * Returns how many full calendar days have elapsed since dateHung (ISO date string).
 * Uses local midnight comparison to avoid timezone drift.
 */
export function daysHanging(dateHung) {
  if (!dateHung) return 0;
  const hung = new Date(dateHung + "T00:00:00Z");
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return Math.max(0, Math.floor((today - hung) / 86400000));
}

/**
 * Days left before the 15-day drying window closes.
 * Negative means overdue.
 */
export function daysRemaining(dateHung) {
  return DRY_DAYS - daysHanging(dateHung);
}

/**
 * Returns a Tailwind text color class based on days remaining.
 */
export function countdownColor(remaining) {
  if (remaining <= 0) return "text-red-500";
  if (remaining <= 3) return "text-red-400";
  if (remaining <= 7) return "text-amber-400";
  return "text-emerald-400";
}

/**
 * Sorts batches ascending by daysRemaining (most urgent first).
 */
export function sortByUrgency(batches) {
  return [...batches].sort((a, b) => daysRemaining(a.dateHung) - daysRemaining(b.dateHung));
}

export const BURP_DAYS = 14;

/**
 * Returns integer days from fillDate to today (or dateSent if archived).
 * Uses same UTC midnight convention as daysHanging().
 */
export function getDaysCured(bin) {
  if (!bin.fillDate) return 0;
  const fill = new Date(bin.fillDate + "T00:00:00Z");
  const now = new Date();
  const end = bin.dateSent
    ? new Date(bin.dateSent + "T00:00:00Z")
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.max(0, Math.floor((end - fill) / 86400000));
}

/**
 * Derives bin lifecycle status. Never stored — always computed.
 * "archived" → harvestId is set
 * "burping"  → days cured ≤ BURP_DAYS
 * "curing"   → days cured > BURP_DAYS
 */
export function getBinStatus(bin) {
  if (bin.harvestId) return "archived";
  return getDaysCured(bin) <= BURP_DAYS ? "burping" : "curing";
}
