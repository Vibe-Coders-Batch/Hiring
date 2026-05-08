import { describe, expect, it } from 'vitest';
import { slugify } from '@/lib/slugify';

describe('slugify', () => {
  it('lowercases and dashes', () => {
    expect(slugify('Senior Wealth Advisor')).toBe('senior-wealth-advisor');
  });
  it('strips punctuation', () => {
    expect(slugify('Head of HR (UAE)!')).toBe('head-of-hr-uae');
  });
  it('caps length at 80', () => {
    const out = slugify('a'.repeat(200));
    expect(out.length).toBeLessThanOrEqual(80);
  });
});
