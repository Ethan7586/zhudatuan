import { describe, expect, it } from 'vitest';
import { Brand } from './Brand';

describe('canonical brand', () => {
  it('selects the shared mark and exposes the product label', () => {
    const result = Brand({ variant: 'mark', product: '运营控制台', inverse: true });
    expect(JSON.stringify(result)).toContain('brand-mark.svg');
    expect(JSON.stringify(result)).toContain('运营控制台');
    expect(JSON.stringify(result)).toContain('"alt":""');
    expect(result.props.className).toContain('swbrand-inverse');
  });
});
