import { beforeEach, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { initialMallDraft } from '../model/MallDraft';
import { MallDraftStore } from './MallDraftStore';

describe('MallDraftStore', () => {
  beforeEach(() => sessionStorage.clear());

  it('restores safe progress without persisting PII, credentials or object references', () => {
    const store = new MallDraftStore();
    const fallback = initialMallDraft(context());
    const draft = {
      ...fallback,
      name: '示范福利商城',
      code: 'DEMO_MALL',
      publicSlug: 'demo-mall',
      brandName: '示范福利',
      contactName: '敏感联系人',
      contactMobile: '+8613812345678',
      creditCode: '91310000MA1K123456',
      businessAddress: '敏感经营地址',
      wechatMerchantId: '1900000001',
      licenseObjectRef: 'object:license',
    };
    store.save('draft', draft);
    const raw = sessionStorage.getItem('draft')!;
    expect(raw).toContain('DEMO_MALL');
    for (const secret of ['敏感联系人', '+8613812345678', '91310000MA1K123456', '敏感经营地址', '1900000001', 'object:license']) expect(raw).not.toContain(secret);
    const restored = store.load('draft', fallback);
    expect(restored).toMatchObject({ name: '示范福利商城', code: 'DEMO_MALL', contactName: fallback.contactName, contactMobile: '' });
  });
});

function context(): ConsoleContext {
  const scope = { kind: 'enterprise' as const, id: 'enterprise:one', name: '示范企业' };
  return {
    session: {
      actor: 'actor:one',
      membership: 'membership:one',
      accessVersion: 1,
      permissions: [],
      capabilities: [],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 2 },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      syncedAt: '2026-09-04T00:00:00.000Z',
    },
    profile: { display_name: '商城管理员', employee_no: null },
    scope,
    scopes: [scope],
  };
}
