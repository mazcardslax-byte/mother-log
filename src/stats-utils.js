// Pure calculation functions for the Stats tab.
// No React, no side effects — all inputs passed explicitly.

/**
 * @param {string} dateStr  ISO date string e.g. "2026-03-25"
 * @returns {number} days elapsed (0 if today, Infinity if null/undefined)
 */
function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86_400_000);
}

/**
 * Returns the date of the most recent feeding/watering entry, or null.
 * @param {Array} feedingLog
 * @returns {string|null}
 */
function lastFeedingDate(feedingLog) {
  if (!feedingLog?.length) return null;
  const sorted = [...feedingLog].filter(e => e.date).sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0]?.date ?? null;
}

/**
 * Aggregate clone rooting rates across all mothers.
 *
 * - "taken" = sum of all cloneLog entry `count` values
 * - "rooted" = sum of `count` where `outcome === 'rooted'`
 * - "rate" = rooted / (rooted + failed) * 100, or 0 if no outcomes recorded
 *
 * @param {Array} mothers
 * @param {Function} getStrain  (strainCode: string) => { name: string }
 * @returns {{ overall: { taken, rooted, rate }, byStrain: Array }}
 */
export function calcCloneRates(mothers, getStrain) {
  const strainMap = {};

  for (const m of mothers) {
    const name = getStrain(m.strainCode)?.name ?? m.strainCode;
    if (!strainMap[m.strainCode]) {
      strainMap[m.strainCode] = { strainCode: m.strainCode, strainName: name, taken: 0, rooted: 0, failed: 0 };
    }
    const s = strainMap[m.strainCode];
    for (const entry of (m.cloneLog ?? [])) {
      const count = entry.count ?? 1;
      s.taken += count;
      if (entry.outcome === 'rooted') s.rooted += count;
      if (entry.outcome === 'failed') s.failed += count;
    }
  }

  const byStrain = Object.values(strainMap).map(s => ({
    ...s,
    rate: (s.rooted + s.failed) > 0 ? Math.round((s.rooted / (s.rooted + s.failed)) * 1000) / 10 : 0,
  })).sort((a, b) => b.rate - a.rate);

  const overall = byStrain.reduce(
    (acc, s) => ({ taken: acc.taken + s.taken, rooted: acc.rooted + s.rooted, failed: acc.failed + s.failed }),
    { taken: 0, rooted: 0, failed: 0 }
  );

  return {
    overall: {
      taken: overall.taken,
      rooted: overall.rooted,
      rate: (overall.rooted + overall.failed) > 0
        ? Math.round((overall.rooted / (overall.rooted + overall.failed)) * 1000) / 10
        : 0,
    },
    byStrain,
  };
}

/**
 * Aggregate per-strain comparison metrics.
 * @param {Array} mothers
 * @param {Function} getStrain
 * @returns {Array<{ strainCode, strainName, motherCount, avgHealth, totalClones, rootingRate }>}
 */
export function calcStrainComparison(mothers, getStrain) {
  const strainMap = {};

  for (const m of mothers) {
    const code = m.strainCode;
    const name = getStrain(code)?.name ?? code;
    if (!strainMap[code]) {
      strainMap[code] = { strainCode: code, strainName: name, healthSum: 0, motherCount: 0, totalClones: 0, rooted: 0, failed: 0 };
    }
    const s = strainMap[code];
    s.healthSum += m.healthLevel ?? 0;
    s.motherCount += 1;
    for (const entry of (m.cloneLog ?? [])) {
      const count = entry.count ?? 1;
      s.totalClones += count;
      if (entry.outcome === 'rooted') s.rooted += count;
      if (entry.outcome === 'failed') s.failed += count;
    }
  }

  return Object.values(strainMap).map(s => ({
    strainCode: s.strainCode,
    strainName: s.strainName,
    motherCount: s.motherCount,
    avgHealth: s.motherCount > 0 ? Math.round((s.healthSum / s.motherCount) * 10) / 10 : 0,
    totalClones: s.totalClones,
    rootingRate: (s.rooted + s.failed) > 0
      ? Math.round((s.rooted / (s.rooted + s.failed)) * 1000) / 10
      : 0,
  })).sort((a, b) => b.avgHealth - a.avgHealth);
}

/**
 * Aggregate clone survival rates from completed trays only.
 * Only trays with status "Done", a known count, and a survived value are included.
 *
 * @param {Array} trays  Array of tray objects from clone_trays_v1
 * @returns {{ overall: { count, survived, rate }, byStrain: Array }}
 */
export function calcTrayRates(trays) {
  const strainMap = {};

  for (const t of trays) {
    if (t.status !== "Done" || t.survived == null || t.count == null) continue;
    const key = t.strainCode ?? t.strainName ?? "unknown";
    if (!strainMap[key]) {
      strainMap[key] = { strainCode: key, strainName: t.strainName ?? key, count: 0, survived: 0 };
    }
    strainMap[key].count += t.count;
    strainMap[key].survived += t.survived;
  }

  const byStrain = Object.values(strainMap).map(s => ({
    ...s,
    rate: s.count > 0 ? Math.round((s.survived / s.count) * 1000) / 10 : 0,
  })).sort((a, b) => b.rate - a.rate);

  const overall = byStrain.reduce(
    (acc, s) => ({ count: acc.count + s.count, survived: acc.survived + s.survived }),
    { count: 0, survived: 0 }
  );

  return {
    overall: {
      count: overall.count,
      survived: overall.survived,
      rate: overall.count > 0 ? Math.round((overall.survived / overall.count) * 1000) / 10 : 0,
    },
    byStrain,
  };
}

/**
 * Return active mothers sorted by days since last feeding (most neglected first).
 * @param {Array} mothers
 * @param {Function} getStrain
 * @returns {Array<{ id, name, location, status, lastDate, daysSinceNum }>}
 */
export function calcCareGaps(mothers, getStrain) {
  return mothers
    .filter(m => m.status === 'Active')
    .map(m => {
      const lastDate = lastFeedingDate(m.feedingLog);
      return {
        id: m.id,
        name: getStrain(m.strainCode)?.name ?? m.strainCode,
        location: m.location,
        status: m.status,
        lastDate,
        daysSinceNum: daysSince(lastDate),
      };
    })
    .sort((a, b) => b.daysSinceNum - a.daysSinceNum);
}
