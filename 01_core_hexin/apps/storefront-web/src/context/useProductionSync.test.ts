import { describe, expect, it } from 'vitest';
import { ProductionApiError } from '../services/productionApi';
import {
  authenticatedMall,
  loadProgressiveCatalog,
  loadQualifiedCatalogWithRecovery,
  sessionBootstrapRetryDelay,
  shouldCloseMemberSession,
  shouldRetainProductionSnapshot,
  shouldRetrySessionBootstrap,
  shouldRetryQualifiedCatalog,
} from './useProductionSync';

describe('production synchronization recovery', () => {
  it('retains the visible snapshot during a temporary network interruption', () => {
    expect(shouldRetainProductionSnapshot(new ProductionApiError('网络连接已中断', 0, 'NETWORK_OR_CLIENT_ERROR'))).toBe(true);
    expect(shouldRetainProductionSnapshot(new ProductionApiError('服务暂时不可用', 503, 'SERVICE_UNAVAILABLE'))).toBe(true);
  });

  it('treats an identity-session failure as terminal before the member shell is published', () => {
    const signedOut = new ProductionApiError('登录会话已失效', 401, 'AUTHENTICATION_REQUIRED');
    const denied = new ProductionApiError('没有权限', 403, 'SCOPE_DENIED');

    expect(shouldRetainProductionSnapshot(signedOut)).toBe(false);
    expect(shouldCloseMemberSession(signedOut)).toBe(true);
    expect(shouldRetainProductionSnapshot(denied)).toBe(true);
    expect(shouldCloseMemberSession(denied)).toBe(false);
  });

  it('retries only transient session failures with a bounded schedule', () => {
    expect(shouldRetrySessionBootstrap(new ProductionApiError('网络连接已中断', 0, 'NETWORK_OR_CLIENT_ERROR'))).toBe(true);
    expect(shouldRetrySessionBootstrap(new ProductionApiError('请求过多', 429, 'TOO_MANY_REQUESTS'))).toBe(true);
    expect(shouldRetrySessionBootstrap(new ProductionApiError('服务暂时不可用', 503, 'SERVICE_UNAVAILABLE'))).toBe(true);
    expect(shouldRetrySessionBootstrap(new ProductionApiError('登录会话已失效', 401, 'AUTHENTICATION_REQUIRED'))).toBe(false);
    expect(shouldRetrySessionBootstrap(new ProductionApiError('页面不存在', 404, 'NOT_FOUND'))).toBe(false);
    expect([0, 1, 2, 3, 4].map(sessionBootstrapRetryDelay)).toEqual([350, 900, 2_000, 4_000, undefined]);
  });

  it('recovers a qualified catalog after a transient production restart', async () => {
    let attempts = 0;
    const waits: number[] = [];
    const result = await loadQualifiedCatalogWithRecovery(async () => {
      attempts += 1;
      if (attempts === 1) throw new ProductionApiError('商城服务暂时繁忙', 503, 'SERVICE_UNAVAILABLE', 'request:one');
      return { items: [apiProduct('member')], pagination: { nextCursor: null } };
    }, () => undefined, async (milliseconds) => { waits.push(milliseconds); });

    expect(result.map((item) => item.id)).toEqual(['member']);
    expect(waits).toEqual([500]);
  });

  it('does not disguise a real login or permission denial as a retryable outage', () => {
    expect(shouldRetryQualifiedCatalog(new ProductionApiError('登录会话已失效', 401, 'AUTHENTICATION_REQUIRED'))).toBe(false);
    expect(shouldRetryQualifiedCatalog(new ProductionApiError('没有权限', 403, 'SCOPE_DENIED'))).toBe(false);
    expect(shouldRetryQualifiedCatalog(new ProductionApiError('商城服务暂时繁忙', 503, 'SERVICE_UNAVAILABLE'))).toBe(true);
  });

  it('builds the stable member shell before account data arrives', () => {
    expect(authenticatedMall({
      actor: {} as never,
      scope: {
        tenantId: 'tenant:one', enterpriseId: 'enterprise:one', mallId: 'mall:one', mallCode: 'HONGTAI',
        mallName: '福福网', brandName: '福福网', enterpriseName: '已授权企业',
      },
    })).toMatchObject({ mallName: '福福网', logoText: '福福网', id: 'mall:one' });
  });

  it('loads extra catalog pages only when the caller explicitly requests them', async () => {
    const published: string[][] = [];
    const waits: string[] = [];
    const result = await loadProgressiveCatalog(async ({ cursor } = {}) => cursor === undefined
      ? { items: [apiProduct('one')], pagination: { nextCursor: 'next' } }
      : { items: [apiProduct('two')], pagination: { nextCursor: null } },
    (items) => published.push(items.map((item) => item.id)),
    async () => { waits.push('idle'); },
    2);

    expect(published).toEqual([['one'], ['one', 'two']]);
    expect(waits).toEqual(['idle']);
    expect(result.map((item) => item.id)).toEqual(['one', 'two']);
  });

  it('keeps the cold-start catalog to its first page', async () => {
    const published: string[][] = [];
    const result = await loadProgressiveCatalog(async ({ cursor } = {}) => cursor === undefined
      ? { items: [apiProduct('one')], pagination: { nextCursor: 'next' } }
      : { items: [apiProduct('two')], pagination: { nextCursor: null } },
    (items) => published.push(items.map((item) => item.id)));

    expect(published).toEqual([['one']]);
    expect(result.map((item) => item.id)).toEqual(['one']);
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
