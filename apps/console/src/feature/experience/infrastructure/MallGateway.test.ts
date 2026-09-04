// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { MallCreateDraft, MallRecord } from '../model/Mall';
import { MallGateway } from './MallGateway';

const requests: Request[] = [];
const mall = Object.freeze({
  id: 'mall:one',
  parentId: 'enterprise:one',
  name: '示范福利商城',
  code: 'DEMO_MALL',
  publicSlug: 'demo-mall',
  brandName: '示范品牌',
  domain: { mode: 'custom' as const, customDomain: 'mall.example.com' },
  ownerMembershipId: 'membership:owner',
  timezone: 'Asia/Shanghai',
  currency: 'CNY',
  theme: { preset: 'shop' as const, primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
  opening: {
    state: 'complete' as const,
    subject: { type: 'enterprise' as const, companyName: '示范企业有限公司', creditCode: '91310000MA1K123456', legalRepresentative: '张三', contactName: '李四', contactMobile: '+8613812345678', licenseObjectRef: null },
    business: { storeType: 'general' as const, primaryCategory: '员工福利', mode: 'selfoperated' as const, region: '上海市', address: '示范路一号', servicePhone: null },
    certificateMode: 'managed' as const,
    certificateObjectRef: null,
    channels: { miniProgramMode: 'later' as const, miniProgramAppId: null, miniProgramOriginalId: null, officialAccountMode: 'later' as const, officialAccountAppId: null, videoChannelId: null },
    payment: { plan: 'later' as const, wechatMerchantId: null },
    fulfillment: { deliveryMode: 'digital' as const, warehouseRegion: null, returnContact: null, returnAddress: null },
    invoiceMode: 'later' as const,
    notificationContact: 'ops@example.com',
  },
  status: 'draft' as const,
  version: 1,
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
}) satisfies MallRecord;

const server = setupServer(
  http.get('*/api/v1/organizations/layers', () =>
    HttpResponse.json({
      items: [
        { id: 'enterprise:one', kind: 'enterprise', parent_id: 'tenant:one', parent_name: '示范租户', name: '示范企业', timezone: 'Asia/Shanghai', status: 'active', version: 7 },
        { id: 'mall:hidden', kind: 'mall', parent_id: 'enterprise:one', parent_name: '示范企业', name: '已有商城', timezone: 'Asia/Shanghai', status: 'active', version: 1 },
      ],
      count: 2,
    })
  ),
  http.all('*/api/v1/organization/malls/**', ({ request }) => {
    requests.push(request.clone());
    return HttpResponse.json(mall);
  }),
  http.all('*/api/v1/organization/malls', ({ request }) => {
    requests.push(request.clone());
    return HttpResponse.json(mall);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
});
afterAll(() => server.close());

describe('MallGateway', () => {
  it('filters the authoritative organization hierarchy to valid mall parents', async () => {
    const page = await new MallGateway('http://localhost').parents(context());
    expect(page).toEqual({ items: [{ id: 'enterprise:one', kind: 'enterprise', parentId: 'tenant:one', name: '示范企业', timezone: 'Asia/Shanghai', version: 7 }], count: 1 });
    expect(Object.isFrozen(page.items)).toBe(true);
  });

  it('sends full create and update profiles with command identity and optimistic versions', async () => {
    const gateway = new MallGateway('http://localhost');
    const draft = createDraft();
    await gateway.create(context(), draft, 'command:create');
    await gateway.update(context(), mall.id, mall.version, { ...draft, status: 'active' }, 'command:update');
    await gateway.read(context(), mall.id);
    expect(requests.map((request) => request.headers.get('idempotency-key'))).toEqual(['command:create', 'command:update', null]);
    expect(requests[0]?.headers.get('if-match')).toBe('"7"');
    expect(requests[1]?.headers.get('if-match')).toBe('"1"');
    const created = (await requests[0]!.json()) as Record<string, unknown>;
    const updated = (await requests[1]!.json()) as Record<string, unknown>;
    expect(created).toMatchObject({ parentId: 'enterprise:one', code: 'DEMO_MALL', publicSlug: 'demo-mall', opening: { notificationContact: 'ops@example.com' } });
    expect(updated).toMatchObject({ name: '示范福利商城', status: 'active', opening: { notificationContact: 'ops@example.com' } });
    expect(updated).not.toHaveProperty('parentId');
    expect(updated).not.toHaveProperty('code');
    expect(updated).not.toHaveProperty('publicSlug');
  });
});

function createDraft(): MallCreateDraft {
  const { id: _id, status: _status, version: _version, createdAt: _createdAt, updatedAt: _updatedAt, opening, ...profile } = mall;
  const { state: _state, ...openingInput } = opening;
  return { ...profile, parentVersion: 7, opening: openingInput };
}

function context(): ConsoleContext {
  const scope = { kind: 'enterprise' as const, id: 'enterprise:one', name: '示范企业' };
  return {
    session: {
      actor: 'actor:one',
      membership: 'membership:owner',
      accessVersion: 9,
      permissions: [],
      capabilities: [],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 3 },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      csrf: 'csrf:one',
      syncedAt: '2026-09-04T00:00:00.000Z',
    },
    profile: { display_name: '商城管理员', employee_no: null },
    scope,
    scopes: [scope],
  };
}
