import { parseExperience } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { PublishPolicy } from '../../domain/policy/PublishPolicy';
import { PgPublicationRepository } from './PgPublicationRepository';

describe('PgPublicationRepository', () => {
  it('collects locatable dependency versions across catalog, qualification, pricing, inventory, resources and mall channels', async () => {
    const ports = dependencies();
    const repository = new PgPublicationRepository(ports.catalog as never, ports.marketing as never, ports.malls as never, ports.qualifications as never, ports.pricing as never, ports.inventory as never, ports.objects as never);
    const evidence = await repository.evidence(context(), document(), 'pool:one', 'mall:one');

    expect(ports.catalog.references).toHaveBeenCalledWith(
      expect.anything(),
      'pool:one',
      expect.objectContaining({
        products: ['product:one'],
        collections: ['pool:one'],
        listings: ['listing:one'],
        campaigns: ['campaign:one'],
      })
    );
    expect(evidence.dependencies).toMatchObject({
      catalog: { ready: true, version: 'catalog:8' },
      qualification: { ready: true, version: 'listing:one@3' },
      pricing: { ready: true },
      inventory: { ready: true },
      resources: { ready: true, version: `object:hero@${'a'.repeat(64)}` },
      domain: { ready: true, version: 'mall:8:custom' },
      channel: { ready: true },
    });
    expect(evidence.issues).toEqual([]);
  });

  it('fails closed with paths that the editor can render when an asset or commercial dependency is unavailable', async () => {
    const ports = dependencies();
    ports.objects.inspect.mockRejectedValue(new Error('OBJECT_STORE_UNAVAILABLE'));
    ports.pricing.offers.mockResolvedValue([]);
    const repository = new PgPublicationRepository(ports.catalog as never, ports.marketing as never, ports.malls as never, ports.qualifications as never, ports.pricing as never, ports.inventory as never, ports.objects as never);
    const evidence = await repository.evidence(context(), document(), 'pool:one', 'mall:one');
    const issues = new PublishPolicy().evaluate(document(), evidence);
    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'RESOURCE_INVALID', path: 'pages.0.blocks.0.content.image' }), expect.objectContaining({ code: 'PRICING_DEPENDENCY_INVALID', path: 'dependencies.pricing' })])
    );
  });
});

function document() {
  return parseExperience({
    version: 2,
    application: 'application:one',
    theme: { preset: 'shop', primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
    navigation: [{ id: 'navigation:home', label: '首页', page: 'home' }],
    assets: [],
    pages: [
      {
        id: 'home',
        path: 'home',
        blocks: [
          { id: 'hero', component: 'hero', content: { title: '福利首页', image: 'object:hero' } },
          { id: 'collection', component: 'productcollection', content: { pool: 'pool:one', productIds: ['product:one'], listingIds: ['listing:one'] } },
          { id: 'shortcut', component: 'shortcut', content: { title: '快捷入口', items: [{ id: 'campaign', label: '福利活动', icon: 'gift', action: { type: 'marketingactivity', target: 'campaign:one' } }] } },
        ],
      },
    ],
  });
}

function context(): ReadTransactionContext {
  return {
    id: 'transaction:experience',
    mode: 'read',
    tenant: 'tenant:one',
    membership: 'membership:one',
    scope: 'mall:one',
    actor: 'member:one',
    trace: 'trace:experience',
    operation: 'experience.versions.validate',
    deadline: Date.now() + 10_000,
    signal: new AbortController().signal,
  } as ReadTransactionContext;
}

function dependencies() {
  return {
    catalog: {
      references: vi.fn(async () => ({
        ready: true,
        version: 'catalog:8',
        items: [{ listing: 'listing:one', product: 'product:one', category: 'category:one', partner: 'partner:one', regions: ['310000'], sku: 'sku:one', version: '8:3:5' }],
      })),
    },
    marketing: { references: vi.fn(async () => ({ ready: true, version: 'campaign:one@2' })) },
    malls: {
      mall: vi.fn(async () => ({
        id: 'mall:one',
        name: '一号商城',
        code: 'MALLONE',
        publicSlug: 'mall-one',
        brandName: '一号',
        domain: { mode: 'custom', customDomain: 'mall.example.com' },
        timezone: 'Asia/Shanghai',
        currency: 'CNY',
        theme: document().theme,
        status: 'active',
        version: 8,
      })),
    },
    qualifications: { decisions: vi.fn(async () => [{ listing: 'listing:one', eligible: true, policyVersion: 3 }]) },
    pricing: {
      offers: vi.fn(async () => [
        {
          sku: 'sku:one',
          amountMinor: 9900,
          compareMinor: null,
          currency: 'CNY',
          version: 'price:4',
          scope: 'mall:one',
          breakdown: [],
          status: 'effective',
          effectiveAt: '2026-09-04T08:00:00.000Z',
          expiresAt: null,
          watermark: '2026-09-04T08:00:00.000Z',
        },
      ]),
    },
    inventory: {
      details: vi.fn(async () => [{ sku: 'sku:one', scope: 'mall:one', onhand: 10, safety: 1, reserved: 0, available: 9, state: 'available', version: 'stock:2', watermark: '2026-09-04T08:00:00.000Z', reservation: {}, sources: [] }]),
    },
    objects: { inspect: vi.fn(async (reference: string) => ({ reference, sha256: 'a'.repeat(64), size: 42, scan: 'clean', contentType: 'image/png', path: 'experience/assets/hero.png' })) },
  };
}
