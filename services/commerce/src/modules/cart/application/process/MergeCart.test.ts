import { describe, expect, it, vi } from 'vitest';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { Cart } from '../../domain/model/Cart';
import { MergeCart } from './MergeCart';

const context = {} as WriteTransactionContext;
const member = Object.freeze({ kind: 'member' as const, member: 'member:1', mall: 'mall:1', application: 'app:1' });
const anonymous = Object.freeze({ kind: 'anonymous' as const, tokenDigest: 'a'.repeat(64), mall: 'mall:1', application: 'app:1' });
function cart(id: string, owner: typeof member | typeof anonymous, lines: readonly Readonly<{ listing: string; sku: string; quantity: number; selected: boolean; version: number }>[]) {
  return new Cart({ id, owner, version: 3, updatedAt: '2026-09-05T00:00:00.000Z', lines });
}

describe('MergeCart', () => {
  it('combines anonymous and member quantities exactly once by business SKU', async () => {
    const source = cart('cart:guest', anonymous, [{ listing: 'listing:guest', sku: 'sku:1', quantity: 2, selected: true, version: 0 }]);
    const target = cart('cart:member', member, [{ listing: 'listing:member', sku: 'sku:1', quantity: 1, selected: false, version: 2 }]);
    const completeMerge = vi.fn(async (_context, _source, _target, changes) => {
      expect(changes).toEqual([expect.objectContaining({ listing: 'listing:member', quantity: 3, selected: true, version: 2 })]);
      return target;
    });
    const process = new MergeCart({ prepareMerge: vi.fn(async () => ({ state: 'ready', source, target })), completeMerge } as never);
    await expect(process.execute(context, anonymous.tokenDigest, member)).resolves.toMatchObject({ cart: { id: 'cart:member' }, notice: { state: 'completed' } });
    expect(completeMerge).toHaveBeenCalledOnce();
  });

  it('replays an existing claim without applying the anonymous lines again', async () => {
    const target = cart('cart:member', member, []);
    const completeMerge = vi.fn();
    const process = new MergeCart({ prepareMerge: vi.fn(async () => ({ state: 'completed' })), current: vi.fn(async () => target), completeMerge } as never);
    await expect(process.execute(context, anonymous.tokenDigest, member)).resolves.toMatchObject({ notice: { state: 'completed' } });
    expect(completeMerge).not.toHaveBeenCalled();
  });

  it('reports a non-lossy merge block when combined quantity exceeds policy', async () => {
    const source = cart('cart:guest', anonymous, [{ listing: 'listing:guest', sku: 'sku:1', quantity: 998, selected: true, version: 0 }]);
    const target = cart('cart:member', member, [{ listing: 'listing:member', sku: 'sku:1', quantity: 2, selected: true, version: 0 }]);
    const completeMerge = vi.fn();
    const process = new MergeCart({ prepareMerge: vi.fn(async () => ({ state: 'ready', source, target })), completeMerge } as never);
    await expect(process.execute(context, anonymous.tokenDigest, member)).resolves.toMatchObject({ cart: { id: 'cart:member' }, notice: { state: 'blocked', reason: 'quantitylimit' } });
    expect(completeMerge).not.toHaveBeenCalled();
  });
});
