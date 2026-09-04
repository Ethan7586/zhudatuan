import { describe, expect, it } from 'vitest';
import { mallOpeningDraft, mallUpdateDraft } from './MallDraft';
import type { MallRecord } from './Mall';

describe('mall draft mapping', () => {
  it('round-trips every editable mall field while keeping immutable identity out of updates', () => {
    const draft = mallOpeningDraft(record());
    const update = mallUpdateDraft(draft);
    expect(update).toMatchObject({ name: '示范商城', brandName: '示范品牌', status: 'active', theme: { preset: 'market' }, opening: { notificationContact: 'ops@example.com' } });
    expect(update).not.toHaveProperty('parentId');
    expect(update).not.toHaveProperty('code');
    expect(update).not.toHaveProperty('publicSlug');
  });
});

function record(): MallRecord {
  return {
    id: 'mall:one',
    parentId: 'enterprise:one',
    name: '示范商城',
    code: 'DEMO_MALL',
    publicSlug: 'demo-mall',
    brandName: '示范品牌',
    domain: { mode: 'custom', customDomain: 'mall.example.com' },
    ownerMembershipId: 'membership:owner',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    theme: { preset: 'market', primaryColor: '#A23B32', accentColor: '#C99A45', logoObjectRef: null, faviconObjectRef: null },
    opening: {
      state: 'complete',
      subject: { type: 'enterprise', companyName: '示范企业有限公司', creditCode: '91310000MA1K123456', legalRepresentative: '张三', contactName: '李四', contactMobile: '+8613812345678', licenseObjectRef: null },
      business: { storeType: 'general', primaryCategory: '员工福利', mode: 'selfoperated', region: '上海市', address: '示范路一号', servicePhone: null },
      certificateMode: 'managed',
      certificateObjectRef: null,
      channels: { miniProgramMode: 'later', miniProgramAppId: null, miniProgramOriginalId: null, officialAccountMode: 'later', officialAccountAppId: null, videoChannelId: null },
      payment: { plan: 'later', wechatMerchantId: null },
      fulfillment: { deliveryMode: 'digital', warehouseRegion: null, returnContact: null, returnAddress: null },
      invoiceMode: 'later',
      notificationContact: 'ops@example.com',
    },
    status: 'active',
    version: 3,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T01:00:00.000Z',
  };
}
