import { describe, expect, it } from 'vitest';
import { voucherKey, voucherPrefix } from './VoucherQueryKey';

describe('VoucherViewModel query identity', () => {
  it('isolates records by client, scope, access, catalog, view and cursor', () => {
    const context = {
      scope: { kind: 'enterprise', id: 'enterprise:one' },
      session: { accessVersion: 7 },
    } as const;
    const first = voucherKey(context as never, 'vouchers');
    const next = voucherKey(context as never, 'vouchers', 'cursor:two');

    expect(first).toContain('console');
    expect(first).toContain('enterprise');
    expect(first).toContain('enterprise:one');
    expect(first).toContain(7);
    expect(first).toContain('vouchers');
    expect(next).not.toEqual(first);
    expect(voucherPrefix(context as never)).toEqual(first.slice(0, 6));
  });
});
