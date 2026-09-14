import { describe, expect, it } from 'vitest';
import { ProductionApiError } from '../services/productionApi';
import { authenticatedMall, loadProgressiveCatalog, shouldRetainProductionSnapshot } from './useProductionSync';

describe('production synchronization recovery', () => {
  it('retains the visible snapshot during a temporary network interruption', () => {
    expect(shouldRetainProductionSnapshot(new ProductionApiError('网络连接已中断', 0, 'NETWORK_OR_CLIENT_ERROR'))).toBe(true);
  });

  it('treats an identity-session failure as terminal before the member shell is published', () => {
    expect(shouldRetainProductionSnapshot(new ProductionApiError('登录会话已失效', 401, 'AUTHENTICATION_REQUIRED'))).toBe(false);
  });

  it('builds the stable member shell before account data arrives', () => {
    expect(authenticatedMall({
      actor: {} as never,
      scope: {
        tenantId: 'tenant:one', enterpriseId: 'enterprise:one', mallId: 'mall:one', mallCode: 'HONGTAI',
        mallName: '宏泰甄选', brandName: '宏泰甄选', enterpriseName: '已授权企业',
      },
    })).toMatchObject({ mallName: '宏泰甄选', logoText: '宏泰甄选', id: 'mall:one' });
  });

  it('publishes the first catalog page before loading the remaining pages', async () => {
    const published: string[][] = [];
    const waits: string[] = [];
    const result = await loadProgressiveCatalog(async ({ cursor } = {}) => cursor === undefined
      ? { items: [apiProduct('one')], pagination: { nextCursor: 'next' } }
      : { items: [apiProduct('two')], pagination: { nextCursor: null } },
    (items) => published.push(items.map((item) => item.id)),
    async () => { waits.push('idle'); });

    expect(published).toEqual([['one'], ['one', 'two']]);
    expect(waits).toEqual(['idle']);
    expect(result.map((item) => item.id)).toEqual(['one', 'two']);
  });
});

function apiProduct(id: string) {
  return {
    id, skuId: `sku:${id}`, name: id, subtitle: null, categoryCode: 'general', coverUrl: null,
    priceCents: 100, marketPriceCents: null, availableStock: 1, supplierName: '供应商', isTest: false,
    purchasable: true,
    qualification: { visible: true, purchasable: true, visibilityReason: 'VISIBLE', purchaseReason: 'PURCHASABLE' },
  };
}
