// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { ScopeGateway } from './ScopeGateway';

const server = setupServer(http.get('*/api/v1/organizations/layers', ({ request }) => {
  const cursor = new URL(request.url).searchParams.get('cursor');
  return cursor === null
    ? HttpResponse.json({ items: [{ id: 'enterprise:one', kind: 'enterprise', parent_id: null, parent_name: null, name: '华东企业', timezone: 'Asia/Shanghai', status: 'active', version: 3 }], count: 1, nextCursor: 'page:two' })
    : HttpResponse.json({ items: [
      { id: 'store:one', kind: 'store', parent_id: 'mall:one', parent_name: '员工商城', name: '朝阳门店', timezone: 'Asia/Shanghai', status: 'active', version: 2 },
      { id: 'store:disabled', kind: 'store', parent_id: 'mall:one', parent_name: '员工商城', name: '停用门店', timezone: 'Asia/Shanghai', status: 'disabled', version: 4 },
    ], count: 2 });
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

describe('ScopeGateway', () => {
  it('collects every page and returns only active authoritative business scopes', async () => {
    const scopes = await new ScopeGateway('http://localhost').read(context());
    expect(scopes.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'enterprise:one', name: '华东企业' },
      { id: 'store:one', name: '朝阳门店' },
    ]);
    expect(Object.isFrozen(scopes)).toBe(true);
  });
});

function context(): ConsoleContext {
  const scope = { kind: 'enterprise' as const, id: 'enterprise:one', name: '华东企业' };
  return {
    session: { actor: 'actor:one', membership: 'membership:owner', accessVersion: 5, permissions: ['organization.layer.read'], capabilities: ['organization.layers.read'], target: 'console', scope, scopes: [scope], assurance: { level: 3 }, security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null }, csrf: 'csrf:scope', syncedAt: '2026-09-04T00:00:00.000Z' },
    profile: { display_name: '权限管理员', employee_no: null }, scope, scopes: [scope],
  };
}
