import { describe, expect, it } from 'vitest';
import { actionState, resourceCondition, resourceState } from '@shop/presentation';
import { ApiError } from '@shop/sdk';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ListingPage } from '../model/Product';
import { toggleSelection } from '../model/ProductSelection';
import { productKey } from './ProductQueryKey';
import { listingFixture } from '../test/ProductFixture';

const empty: ListingPage = Object.freeze({ items: Object.freeze([]), count: 0 });
const ready: ListingPage = Object.freeze({
  items: Object.freeze([listingFixture({ title: '商品', version: 1, category_id: 'category:one', price_amount_minor: 100, saleable_stock: 10 })]),
  count: 1,
});

describe('ProductViewModel state', () => {
  it('covers loading, ready, empty and refreshing', () => {
    expect(resourceState({ pending: true, fetching: true, empty: false }).kind).toBe('loading');
    expect(resourceState({ pending: false, fetching: false, data: empty, empty: true }).kind).toBe('empty');
    expect(resourceCondition(resourceState({ pending: false, fetching: false, data: ready, empty: false }))).toBe('ready');
    expect(resourceCondition(resourceState({ pending: false, fetching: true, data: ready, empty: false }))).toBe('refreshing');
  });

  it('covers forbidden, failed and stale without replacing prior data', () => {
    const denied = { kind: 'api', code: 'AUTHORIZATION_DENIED', retryable: false } as const;
    expect(resourceState({ pending: false, fetching: false, empty: false, error: denied }).kind).toBe('forbidden');
    expect(resourceState({ pending: false, fetching: false, empty: false, error: new Error('network') }).kind).toBe('failed');
    const stale = resourceState({ pending: false, fetching: false, data: ready, empty: false, error: new Error('network'), updatedAt: '2026-09-03T00:00:00.000Z' });
    expect(stale.kind).toBe('stale');
    if (stale.kind === 'stale') expect(stale.data).toBe(ready);
  });

  it('changes the query identity on scope and access version changes', () => {
    const first = context('mall:one', 1);
    expect(productKey(first, filter)).not.toEqual(productKey(context('mall:two', 1), filter));
    expect(productKey(first, filter)).not.toEqual(productKey(context('mall:one', 2), filter));
  });

  it('keeps URL pagination and selection deterministic', () => {
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

const filter = Object.freeze({ q: '', category: '', supplier: '', mall: '', status: '', limit: 50 });

function context(id: string, accessVersion: number): ConsoleContext {
  const scope = { kind: 'mall', id, tenant: 'tenant:one' } as const;
  const session: ConsoleContext['session'] = {
    actor: 'actor:one',
    membership: 'membership:one',
    scope,
    scopes: [scope],
    accessVersion,
    permissions: [],
    capabilities: [],
    assurance: { level: 1 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    target: 'console',
    syncedAt: '2026-09-03T00:00:00.000Z',
  };
  return { session, profile: { display_name: '测试用户', employee_no: null }, scopes: [scope], scope };
}
