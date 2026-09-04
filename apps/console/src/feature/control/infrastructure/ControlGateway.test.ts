// @vitest-environment node
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { ControlGateway } from './ControlGateway';

const gateway = new ControlGateway('http://localhost');
const requests: URL[] = [];
const server = setupServer(
  http.get('*/api/v1/organizations/layers', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json(page());
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Control gateway', () => {
  it('maps DTO names into immutable platform models and preserves keyset pagination', async () => {
    const result = await gateway.platform(context(), 'cursor:2', new AbortController().signal);
    expect(result).toMatchObject({ count: 1, nextCursor: 'cursor:3' });
    expect(result.items[0]).toMatchObject({ parentId: 'platform:one', parentName: '福利商城平台', timezone: 'Asia/Shanghai' });
    expect(Object.isFrozen(result.items[0])).toBe(true);
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({ limit: '50', cursor: 'cursor:2' });
  });

  it('propagates cancellation and rejects inconsistent page counts', async () => {
    server.use(
      http.get('*/api/v1/organizations/layers', async () => {
        await delay('infinite');
        return HttpResponse.json(page());
      })
    );
    const controller = new AbortController();
    const pending = gateway.platform(context(), undefined, controller.signal);
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();
    server.use(http.get('*/api/v1/organizations/layers', () => HttpResponse.json({ ...page(), count: 2 })));
    await expect(gateway.platform(context())).rejects.toThrow('CONTROL_PAGE_COUNT_MISMATCH');
  });
});

function context(): ConsoleContext {
  const scope = { kind: 'platform' as const, id: 'platform:one' };
  return {
    session: {
      actor: 'actor:one',
      membership: 'membership:one',
      accessVersion: 7,
      permissions: [],
      capabilities: [],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 2 },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      syncedAt: '2026-08-30T00:00:00Z',
    },
    profile: { display_name: '平台管理员', employee_no: null },
    scope,
    scopes: [scope],
  };
}
function page() {
  return { items: [{ id: 'enterprise:one', kind: 'enterprise', parent_id: 'platform:one', parent_name: '福利商城平台', name: '鸿泰集团', timezone: 'Asia/Shanghai', status: 'active', version: 2 }], count: 1, nextCursor: 'cursor:3' };
}
