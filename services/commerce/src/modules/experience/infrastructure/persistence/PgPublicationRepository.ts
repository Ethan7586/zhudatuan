import type { ExperienceAction, ExperienceDocument } from '@shop/contract';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import { allParallel, mapParallel } from '@shop/kernel';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ExperienceCatalogEvidence, ExperienceCatalogPort } from '../../../catalog/public';
import type { InventoryReadPort } from '../../../inventory/public/InventoryReadPort';
import type { MarketingReadPort } from '../../../marketing/public';
import type { MallProvisionPort } from '../../../organization/public';
import type { PricingReadPort } from '../../../pricing/public/PricingReadPort';
import type { CatalogQualificationPort } from '../../../qualification/public/CatalogQualificationPort';
import type { PublicationRepository } from '../../application/port/PublicationRepository';
import { ComponentTree, type ComponentIssue } from '../../domain/value/ComponentTree';
import { PublishEvidence } from '../../domain/value/PublishEvidence';

export class PgPublicationRepository implements PublicationRepository {
  constructor(
    private readonly catalog: ExperienceCatalogPort,
    private readonly marketing: Pick<MarketingReadPort, 'references'>,
    private readonly malls: MallProvisionPort,
    private readonly qualifications: CatalogQualificationPort,
    private readonly pricing: PricingReadPort,
    private readonly inventory: InventoryReadPort,
    private readonly objects: ObjectStore
  ) {}

  async evidence(context: ReadTransactionContext, document: ExperienceDocument, pool: string | null, mallId: string): Promise<PublishEvidence> {
    const tree = ComponentTree.create(document);
    const references = collect(document);
    const pages = new Set(document.pages.flatMap((page) => [page.id, page.path]));
    const issues: ComponentIssue[] = references.micropages
      .filter((target) => !pages.has(target))
      .map((target) =>
        Object.freeze({
          code: 'MICROPAGE_MISSING',
          path: 'pages',
          message: `微页面 ${target} 不存在`,
        })
      );
    const [catalog, marketing, mall, resources] = await allParallel(
      [
        () => (pool === null ? Promise.resolve(missingCatalog()) : this.catalog.references(context, pool, references)),
        () => this.marketing.references(context, references.campaigns),
        () => this.malls.mall(context, mallId, 1),
        () => resourceEvidence(this.objects, tree),
      ] as const,
      parallel(context, 4)
    );
    const skus = Object.freeze([...new Set(catalog.items.map((item) => item.sku))].sort());
    const [qualifications, offers, stock] = await allParallel(
      [
        () =>
          this.qualifications.decisions(
            context,
            mallId,
            catalog.items.map((item) => ({ listing: item.listing, product: item.product, category: item.category, partner: item.partner, regions: item.regions }))
          ),
        () => this.pricing.offers(context, mallId, skus),
        () => this.inventory.details(context, mallId, skus, null),
      ] as const,
      parallel(context, 3)
    );
    issues.push(...resources.issues);
    const qualificationReady = qualifications.length === catalog.items.length && qualifications.every((decision) => decision.eligible);
    const pricingReady = offers.length === skus.length && offers.every((offer) => offer.amountMinor >= 0 && offer.currency === mall?.currency);
    const inventoryReady = stock.length === skus.length && stock.every((item) => item.state === 'available' && item.available > 0);
    const domainReady = mall !== null && (mall.domain.mode === 'platform' || domain(mall.domain.customDomain));
    return PublishEvidence.collect(
      {
        catalog: dependency(catalog.ready, catalog.version),
        marketing: dependency(marketing.ready, marketing.version),
        pool: dependency(pool !== null && catalog.ready, pool === null ? 'none' : `${pool}@${catalog.version}`),
        qualification: dependency(qualificationReady, versions(qualifications.map((item) => `${item.listing}@${item.policyVersion}`))),
        pricing: dependency(pricingReady, versions(offers.map((item) => `${item.sku}@${item.version}:${item.watermark}`))),
        inventory: dependency(inventoryReady, versions(stock.map((item) => `${item.sku}@${item.version}:${item.watermark}`))),
        resources: dependency(resources.ready, resources.version),
        domain: dependency(domainReady, mall === null ? 'missing' : `mall:${mall.version}:${mall.domain.mode}`),
        capabilities: dependency(mall !== null && mall.currency === 'CNY' && mall.version > 0, mall === null ? 'missing' : `mall:${mall.version}:${mall.currency}`),
        channel: dependency(mall !== null && mall.status !== 'disabled', mall === null ? 'missing' : `mall:${mall.version}:${mall.status}`),
      },
      issues
    );
  }
}

function collect(document: ExperienceDocument) {
  const values = new Map<string, Set<string>>();
  const add = (action: ExperienceAction | undefined) => {
    if (!action) return;
    const targets = values.get(action.type) ?? new Set<string>();
    targets.add(action.target);
    values.set(action.type, targets);
  };
  const products = new Set<string>();
  const listings = new Set<string>();
  const collections = new Set<string>();
  for (const page of document.pages) {
    for (const block of page.blocks) {
      add(block.action);
      if (block.component !== 'productcollection' && block.component !== 'shortcut') continue;
      const content = block.content;
      for (const value of stringList(content.productIds)) products.add(value);
      for (const value of stringList(content.listingIds)) listings.add(value);
      for (const value of [content.collectionId, content.pool]) if (typeof value === 'string') collections.add(value);
      if (Array.isArray(content.items))
        for (const item of content.items) {
          if (item !== null && typeof item === 'object' && !Array.isArray(item)) add(Reflect.get(item, 'action') as ExperienceAction | undefined);
        }
    }
  }
  const list = (kind: string) => Object.freeze([...(values.get(kind) ?? [])].sort());
  return Object.freeze({
    products: Object.freeze([...new Set([...products, ...list('product'), ...list('exchangeableproduct')])].sort()),
    categories: list('category'),
    collections: Object.freeze([...new Set([...collections, ...list('collection')])].sort()),
    listings: Object.freeze([...listings].sort()),
    campaigns: list('marketingactivity'),
    micropages: list('micropage'),
  });
}

async function resourceEvidence(objects: ObjectStore, tree: ComponentTree): Promise<Readonly<{ ready: boolean; version: string; issues: readonly ComponentIssue[] }>> {
  const resources = tree.resourceReferences();
  if (resources.length === 0) return Object.freeze({ ready: true, version: 'none', issues: Object.freeze([]) });
  const inspected = await mapParallel(resources, 8, async (resource) => {
    try {
      const object = await objects.inspect(resource.reference);
      return Object.freeze({ resource, hash: object.sha256, valid: object.reference === resource.reference && object.scan === 'clean' });
    } catch {
      return Object.freeze({ resource, hash: 'missing', valid: false });
    }
  });
  const issues = inspected
    .filter((item) => !item.valid)
    .map(({ resource }) =>
      Object.freeze({
        code: 'RESOURCE_INVALID',
        path: resource.path,
        message: `资源 ${resource.reference} 不存在或未通过安全扫描`,
      })
    );
  return Object.freeze({
    ready: issues.length === 0,
    version: inspected
      .map((item) => `${item.resource.reference}@${item.hash}`)
      .sort()
      .join('|'),
    issues: Object.freeze(issues),
  });
}

function missingCatalog(): ExperienceCatalogEvidence {
  return Object.freeze({ ready: false, version: 'none', items: Object.freeze([]) });
}
function dependency(ready: boolean, version: string) {
  return Object.freeze({ ready, version: version || 'none' });
}
function versions(values: readonly string[]): string {
  return values.length === 0 ? 'none' : [...values].sort().join('|');
}
function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
function domain(value: string): boolean {
  return value.length <= 253 && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
}
function parallel(context: ReadTransactionContext, concurrency: number) {
  return { concurrency, expiresAt: context.deadline, signal: context.signal };
}
