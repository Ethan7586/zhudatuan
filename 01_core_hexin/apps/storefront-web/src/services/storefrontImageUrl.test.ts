import { describe, expect, it } from 'vitest';
import { storefrontImageUrl } from './storefrontImageUrl';

describe('storefront image sizing', () => {
  it('requests a right-sized Unsplash thumbnail', () => {
    const result = storefrontImageUrl('https://images.unsplash.com/photo-one?w=600&auto=format&fit=crop&q=80', 112);
    expect(result).toContain('w=112');
    expect(result).toContain('q=72');
  });

  it('does not rewrite supplier image hosts', () => {
    expect(storefrontImageUrl('https://cdn.example.com/product.jpg', 112)).toBe('https://cdn.example.com/product.jpg');
  });
});
