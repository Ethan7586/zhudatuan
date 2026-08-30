// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SessionSchema, uniqueScopes } from '../entity/session/ConsoleSession';
import { workstations } from '../shell/Workstation';
import { pageCursor } from '../shared/url/PageCursor';
import { professionalRouteFromPath, professionalRoutes } from './ProfessionalRouteCatalog';
import { scopePath } from '../shared/url/ScopePath';

describe('Console route manifest', () => {
  it('exposes the five named workstations exactly once', () => {
    expect(workstations.map(({ key }) => key)).toEqual(['cockpit', 'control', 'products', 'orders', 'finance']);
    expect([...new Set(workstations.map(({ key }) => key))]).toHaveLength(5);
  });

  it('puts kind and id in a deep-linkable scope URL', () => {
    expect(scopePath({ kind: 'enterprise', id: 'group/鸿泰' }, 'products'))
      .toBe('/scopes/enterprise/group%2F%E9%B8%BF%E6%B3%B0/products');
  });

  it('publishes every Batch 6 professional deep link without pretending blocked writes exist', () => {
    expect(professionalRoutes.map(({ featureKey }) => featureKey)).toEqual([
      'applications', 'vouchers', 'reports', 'support', 'channels', 'imports', 'entries', 'statements',
      'reconciliations', 'settlements', 'withdrawals', 'invoices', 'access', 'members', 'qualification',
      'notification', 'productdetail', 'orderdetail',
    ]);
    expect(professionalRouteFromPath('/scopes/enterprise/group%3A1/finance/settlements')?.operation)
      .toBe('finance.settlements.read');
    expect(professionalRouteFromPath('/scopes/mall/mall%3A1/imports/voucher/job%3A1')?.operations)
      .toContain('voucher.imports.read');
    expect(professionalRouteFromPath('/scopes/mall/mall%3A1/products/product%3A1')?.blocker)
      .toContain('catalog.product.detail.read');
  });

  it('deduplicates scopes by kind and id without mutable global selection', () => {
    const scopes = uniqueScopes([
      { kind: 'mall', id: 'mall:2', name: '喜悦会' },
      { kind: 'enterprise', id: 'group:1', name: '鸿泰集团' },
      { kind: 'mall', id: 'mall:2', name: '喜悦会' },
    ]);
    expect(scopes.map(({ id }) => id)).toEqual(['group:1', 'mall:2']);
  });

  it('normalizes the server access version before it enters RequestContext and Query keys', () => {
    const session = SessionSchema.parse({ actor: 'actor:1', membership: 'membership:1', accessVersion: '7', permissions: [], capabilities: [],
      target: 'console', scope: { kind: 'enterprise', id: 'group:1' }, scopes: [{ kind: 'enterprise', id: 'group:1' }],
      assurance: { level: 1 }, csrf: 'csrf-token-from-api-session', syncedAt: '2026-08-26T00:00:00Z' });
    expect(session.accessVersion).toBe(7);
    expect(session.csrf).toBe('csrf-token-from-api-session');
  });

  it('preserves server filters when advancing a cursor page', () => {
    expect(pageCursor(new URLSearchParams('q=milk'), 'cursor:2').toString()).toBe('q=milk&cursor=cursor%3A2');
  });
});
