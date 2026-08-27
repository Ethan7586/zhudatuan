import { describe, expect, it } from 'vitest';
import { Brand } from './Brand';

describe('canonical brand', () => {
  it('selects the shared mark and exposes the product label', () => {
    const result = Brand({ variant: 'mark', product: '运营控制台', inverse: true });
    expect(JSON.stringify(result)).toContain('brand-mark.svg');
    expect(JSON.stringify(result)).toContain('运营控制台');
<<<<<<< HEAD
    expect(JSON.stringify(result)).toContain('"alt":""');
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    expect(result.props.className).toContain('swbrand-inverse');
  });
});
