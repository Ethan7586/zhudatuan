import { describe, expect, it } from 'vitest';
import { actionState } from '@shop/presentation';
import { ApiError } from '@shop/sdk';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ListingPage } from '../model/Product';
import { toggleSelection } from '../model/ProductSelection';
import { productKey } from './ProductQueryKey';
import { pageLimit, pageNumber, productCondition, productState } from './ProductReducer';

const empty: ListingPage = Object.freeze({ items: Object.freeze([]), count: 0 });
const ready: ListingPage = Object.freeze({ items: Object.freeze([{ id: 'listing:one', sku_id: 'sku:one', product_id: 'product:one', title: '商品', status: 'published', version: 1 }]), count: 1 });

describe('ProductViewModel state', () => {
  it('covers loading, ready, empty and refreshing', () => {
    expect(productState({ pending: true, fetching: true, empty: false }).kind).toBe('loading');
    expect(productState({ pending: false, fetching: false, data: empty, empty: true }).kind).toBe('empty');
    expect(productCondition(productState({ pending: false, fetching: false, data: ready, empty: false }))).toBe('ready');
    expect(productCondition(productState({ pending: false, fetching: true, data: ready, empty: false }))).toBe('refreshing');
  });

  it('covers denied, failed and stale without replacing prior data', () => {
    const denied = { kind: 'api', code: 'AUTHORIZATION_DENIED', retryable: false } as const;
    expect(productState({ pending: false, fetching: false, empty: false, error: denied }).kind).toBe('denied');
    expect(productState({ pending: false, fetching: false, empty: false, error: new Error('network') }).kind).toBe('failed');
    const stale = productState({ pending: false, fetching: false, data: ready, empty: false, error: new Error('network'), updatedAt: '2026-09-03T00:00:00.000Z' });
    expect(stale.kind).toBe('stale');
    if (stale.kind === 'stale') expect(stale.data).toBe(ready);
  });

  it('changes the query identity on scope and access version changes', () => {
    const first = context('mall:one', 1);
    expect(productKey(first, { q: '', category: '', limit: 50 })).not.toEqual(productKey(context('mall:two', 1), { q: '', category: '', limit: 50 }));
    expect(productKey(first, { q: '', category: '', limit: 50 })).not.toEqual(productKey(context('mall:one', 2), { q: '', category: '', limit: 50 }));
  });

  it('keeps URL pagination and selection deterministic', () => {
    expect(pageNumber('-1')).toBe(1);
    expect(pageLimit('999')).toBe(50);
    const selected = toggleSelection(new Set<string>(), 'listing:one');
    expect(selected.has('listing:one')).toBe(true);
    expect(toggleSelection(selected, 'listing:one').size).toBe(0);
  });

  it('keeps a command identity while submitting and preserves conflict or step-up failures', () => {
    expect(actionState({ pending: true, commandId: 'command:one' })).toEqual({ kind: 'submitting', commandId: 'command:one' });
    const conflict = actionState({ pending: false, commandId: 'command:one', error: new ApiError('VERSION_CONFLICT', 409, 'request:one') });
    const stepup = actionState({ pending: false, commandId: 'command:one', error: new ApiError('STEPUP_REQUIRED', 403, 'request:two') });
    expect(conflict.kind === 'failed' ? conflict.failure.code : '').toBe('VERSION_CONFLICT');
    expect(stepup.kind === 'failed' ? stepup.failure.code : '').toBe('STEPUP_REQUIRED');
  });
});

function context(id: string, accessVersion: number): ConsoleContext {
  const scope = { kind: 'mall', id, tenant: 'tenant:one' } as const;
  const session: ConsoleContext['session'] = { actor: 'actor:one', membership: 'membership:one', scope, scopes: [scope], accessVersion, permissions: [], capabilities: [], assurance: { level: 1 }, security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null }, target: 'console', syncedAt: '2026-09-03T00:00:00.000Z' };
  return { session, profile: { display_name: '测试用户', employee_no: null }, scopes: [scope], scope };
}
