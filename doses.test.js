import { describe, expect, it } from 'vitest';
import { occurrences, validateMedicine, validOccurrence } from './doses';

describe('local daily dose scheduling', () => {
  const now = new Date(2026, 9, 23, 0, 5).getTime();
  const medicine = { id: 'm1', name: 'Example', dose: '1 tablet', times: ['23:55', '09:00'], createdAt: now - 86400000 };
  it('keeps yesterday’s dose through midnight and includes today’s upcoming doses', () => {
    const doses = occurrences([medicine], now);
    expect(doses).toHaveLength(4);
    expect(doses.some((dose) => dose.scheduledTime === now - 600000)).toBe(true);
  });
  it('never creates daily doses before the medicine was added or its timestamp confirmed', () => {
    expect(occurrences([{ ...medicine, createdAt: now }], now)).toHaveLength(2);
    expect(occurrences([{ ...medicine, createdAt: null }], now)).toEqual([]);
  });
  it('adds a one-shot demo and keeps stable IDs across checks', () => {
    const first = occurrences([{ ...medicine, demoAt: now + 60000 }], now);
    const later = occurrences([{ ...medicine, demoAt: now + 60000 }], now + 10000);
    expect(first.find((dose) => dose.demo).id).toBe(later.find((dose) => dose.demo).id);
  });
  it('rejects invalid, duplicate and excessive times', () => {
    for (const times of [[], ['25:00'], ['09:00', '09:00'], Array(7).fill('09:00')]) expect(() => validateMedicine({ ...medicine, times })).toThrow();
    expect(validateMedicine({ ...medicine, name: ' Example ' })).toEqual({ name: 'Example', dose: '1 tablet', times: ['09:00', '23:55'] });
  });
  it('rejects arbitrary timestamps that are not scheduled occurrences', () => {
    expect(validOccurrence(medicine, now)).toBe(false);
    expect(validOccurrence(medicine, new Date(2026, 9, 23, 9).getTime())).toBe(true);
  });
});
