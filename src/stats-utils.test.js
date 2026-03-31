import { describe, it, expect } from 'vitest';
import { calcCloneRates, calcStrainComparison, calcCareGaps } from './stats-utils';

// ─── Test data ────────────────────────────────────────────────────────────────
const STRAINS = {
  GG: { name: 'GG#4' },
  WC: { name: 'Wedding Cake' },
};
const getStrain = (code) => STRAINS[code] ?? { name: code };

const mothers = [
  {
    id: 'm1', strainCode: 'GG', status: 'Active',
    healthLevel: 4, healthLog: [],
    location: 'B1-S1', createdAt: '2025-10-01',
    transplantHistory: [{ date: '2025-10-15' }],
    feedingLog: [
      { id: 'f1', date: '2026-03-25', type: 'Water Only', notes: '' },
    ],
    cloneLog: [
      { id: 'c1', date: '2026-01-10', count: 10, outcome: 'rooted' },
      { id: 'c2', date: '2026-02-01', count: 5, outcome: 'failed' },
      { id: 'c3', date: '2026-02-15', count: 3, outcome: null },
    ],
    amendmentLog: [], reductionLog: [], photos: [],
  },
  {
    id: 'm2', strainCode: 'WC', status: 'Active',
    healthLevel: 3, healthLog: [],
    location: 'B1-S2', createdAt: '2025-11-01',
    transplantHistory: [],
    feedingLog: [
      { id: 'f2', date: '2026-03-10', type: 'Water Only', notes: '' },
    ],
    cloneLog: [
      { id: 'c4', date: '2026-01-20', count: 8, outcome: 'rooted' },
      { id: 'c5', date: '2026-02-20', count: 4, outcome: 'failed' },
    ],
    amendmentLog: [], reductionLog: [], photos: [],
  },
];

// ─── calcCloneRates ───────────────────────────────────────────────────────────
describe('calcCloneRates', () => {
  it('calculates overall taken and rooted correctly', () => {
    const result = calcCloneRates(mothers, getStrain);
    // taken = sum of all count values: 10+5+3+8+4 = 30
    expect(result.overall.taken).toBe(30);
    // rooted = count where outcome === 'rooted': 10 + 8 = 18
    expect(result.overall.rooted).toBe(18);
    // rate = rooted / (rooted + failed) = 18 / (18 + 9) = 66.7%
    expect(result.overall.rate).toBeCloseTo(66.7, 0);
  });

  it('returns byStrain sorted by rate descending', () => {
    const result = calcCloneRates(mothers, getStrain);
    expect(result.byStrain).toHaveLength(2);
    expect(result.byStrain[0].strainName).toBeTruthy();
  });

  it('returns zero rate when no outcomes recorded', () => {
    const noOutcome = [{ ...mothers[0], cloneLog: [{ id: 'x', count: 5, outcome: null }] }];
    const result = calcCloneRates(noOutcome, getStrain);
    expect(result.overall.rate).toBe(0);
    expect(result.byStrain[0].rate).toBe(0);
  });

  it('handles empty mothers array', () => {
    const result = calcCloneRates([], getStrain);
    expect(result.overall.taken).toBe(0);
    expect(result.overall.rooted).toBe(0);
    expect(result.overall.rate).toBe(0);
    expect(result.byStrain).toHaveLength(0);
  });
});

// ─── calcStrainComparison ─────────────────────────────────────────────────────
describe('calcStrainComparison', () => {
  it('returns one row per strain with correct avgHealth', () => {
    const result = calcStrainComparison(mothers, getStrain);
    const gg = result.find(r => r.strainCode === 'GG');
    expect(gg.avgHealth).toBe(4);
    const wc = result.find(r => r.strainCode === 'WC');
    expect(wc.avgHealth).toBe(3);
  });

  it('calculates totalClones as sum of all count values', () => {
    const result = calcStrainComparison(mothers, getStrain);
    const gg = result.find(r => r.strainCode === 'GG');
    expect(gg.totalClones).toBe(18); // 10+5+3
  });

  it('calculates rootingRate correctly', () => {
    const result = calcStrainComparison(mothers, getStrain);
    const gg = result.find(r => r.strainCode === 'GG');
    // GG: 10 rooted / (10+5) resolved = 66.7%
    expect(gg.rootingRate).toBeCloseTo(66.7, 0);
  });
});

// ─── calcCareGaps ─────────────────────────────────────────────────────────────
describe('calcCareGaps', () => {
  it('only includes active mothers', () => {
    const withSidelined = [
      ...mothers,
      { ...mothers[0], id: 'm3', status: 'Sidelined', strainCode: 'GG' },
    ];
    const result = calcCareGaps(withSidelined, getStrain);
    expect(result.every(r => r.status === 'Active')).toBe(true);
  });

  it('sorts by daysSince descending (most neglected first)', () => {
    const result = calcCareGaps(mothers, getStrain);
    // m2 last watered Mar 10 (older), m1 last watered Mar 25 (more recent)
    expect(result[0].id).toBe('m2');
  });

  it('handles mothers with no feeding log (sorts first as most neglected)', () => {
    const noFeeds = [{ ...mothers[0], feedingLog: [] }];
    const result = calcCareGaps(noFeeds, getStrain);
    expect(result[0].lastDate).toBeNull();
  });
});
