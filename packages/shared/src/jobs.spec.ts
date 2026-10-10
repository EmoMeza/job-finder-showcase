import { describe, expect, it } from 'vitest';
import { formatSalary, type JobSalary } from './jobs.js';

const salary = (changes: Partial<JobSalary>): JobSalary => ({
  min: 1900,
  max: 2600,
  currency: 'USD',
  period: 'month',
  basis: 'gross',
  public: true,
  ...changes,
});

describe('formatSalary', () => {
  it.each([
    [{}, 'USD 1.900 – 2.600 al mes'],
    [{ max: null }, 'USD 1.900 al mes'],
    [{ min: null }, 'USD 2.600 al mes'],
    [{ min: 2000, max: 2000 }, 'USD 2.000 al mes'],
    [{ min: 30000, max: 40000, period: 'year' as const }, 'USD 30.000 – 40.000 al año'],
  ])('%j → %s', (changes, expected) => {
    expect(formatSalary(salary(changes))).toBe(expected);
  });
});
