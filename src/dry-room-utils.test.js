// src/dry-room-utils.test.js
import { describe, it, expect } from 'vitest';
import { daysHanging, daysRemaining, countdownColor, sortByUrgency, DRY_DAYS } from './dry-room-utils';

describe('daysHanging', () => {
  it('returns 0 when dateHung is today', () => {
    const today = new Date().toISOString().split("T")[0];
    expect(daysHanging(today)).toBe(0);
  });

  it('returns 1 when dateHung was yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split("T")[0];
    expect(daysHanging(yesterday)).toBe(1);
  });

  it('returns 15 when dateHung was 15 days ago', () => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    const date = d.toISOString().split("T")[0];
    expect(daysHanging(date)).toBe(15);
  });

  it('returns 0 for null input', () => {
    expect(daysHanging(null)).toBe(0);
  });
});

describe('daysRemaining', () => {
  it('returns 15 when hung today', () => {
    const today = new Date().toISOString().split("T")[0];
    expect(daysRemaining(today)).toBe(15);
  });

  it('returns 0 when hung exactly 15 days ago', () => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    expect(daysRemaining(d.toISOString().split("T")[0])).toBe(0);
  });

  it('returns negative when overdue', () => {
    const d = new Date();
    d.setDate(d.getDate() - 16);
    expect(daysRemaining(d.toISOString().split("T")[0])).toBe(-1);
  });
});

describe('countdownColor', () => {
  it('returns red-500 when overdue (remaining <= 0)', () => {
    expect(countdownColor(0)).toBe("text-red-500");
    expect(countdownColor(-1)).toBe("text-red-500");
  });

  it('returns red-400 for 1-3 days remaining', () => {
    expect(countdownColor(1)).toBe("text-red-400");
    expect(countdownColor(3)).toBe("text-red-400");
  });

  it('returns amber for 4-7 days remaining', () => {
    expect(countdownColor(4)).toBe("text-amber-400");
    expect(countdownColor(7)).toBe("text-amber-400");
  });

  it('returns emerald for 8+ days remaining', () => {
    expect(countdownColor(8)).toBe("text-emerald-400");
    expect(countdownColor(15)).toBe("text-emerald-400");
  });
});

describe('sortByUrgency', () => {
  it('sorts batches with least days remaining first', () => {
    const today = new Date();
    const d = (offset) => {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - offset);
      return dt.toISOString().split("T")[0];
    };
    const batches = [
      { id: 'a', dateHung: d(2) },  // 13 remaining
      { id: 'b', dateHung: d(14) }, // 1 remaining
      { id: 'c', dateHung: d(0) },  // 15 remaining
    ];
    const sorted = sortByUrgency(batches);
    expect(sorted[0].id).toBe('b');
    expect(sorted[1].id).toBe('a');
    expect(sorted[2].id).toBe('c');
  });

  it('does not mutate the original array', () => {
    const today = new Date().toISOString().split("T")[0];
    const batches = [{ id: 'x', dateHung: today }];
    sortByUrgency(batches);
    expect(batches[0].id).toBe('x');
  });
});
