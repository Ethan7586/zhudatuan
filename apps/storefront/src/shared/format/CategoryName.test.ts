import { describe, expect, it } from 'vitest';
import { categoryName } from './CategoryName';

describe('categoryName', () => {
  it('keeps business names and replaces technical taxonomy values', () => {
    expect(categoryName('食品饮料', 'cat_food')).toBe('食品饮料');
    expect(categoryName('virtual-card', 'virtual-card')).toBe('电子卡券');
    expect(categoryName('unknown-code', 'unknown-code')).toBe('其他福利');
  });
});
