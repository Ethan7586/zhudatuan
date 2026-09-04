import { createRequestContext } from '@shop/sdk/context';
import { createFetchCatalog, createFetchCatalogListingsRead, createFetchCatalogPoolsRead, createFetchCatalogProductDetailRead } from '@shop/sdk/catalog';
import { createFetchPricing } from '@shop/sdk/pricing';
import type { Listing, Pool, ProductDraft, ProductReceipt } from '../model/Product';
import type { ProductCommand, ProductPort, ProductQuery, ProductRequest } from '../public';
import { ProductMapper } from './ProductMapper';

export interface ProductGatewayConfig {
  readonly apiBaseUrl: string;
  readonly clientVersion: string;
  readonly catalogVersion: string;
}

export class ProductGateway implements ProductPort {
  private readonly catalog;
  private readonly pricing;
  private readonly listings;
  private readonly detail;
  private readonly pools;

  constructor(
    private readonly config: ProductGatewayConfig,
    private readonly mapper = new ProductMapper()
  ) {
    this.catalog = createFetchCatalog(config.apiBaseUrl);
    this.pricing = createFetchPricing(config.apiBaseUrl);
    this.listings = createFetchCatalogListingsRead(config.apiBaseUrl);
    this.detail = createFetchCatalogProductDetailRead(config.apiBaseUrl);
    this.pools = createFetchCatalogPoolsRead(config.apiBaseUrl);
  }

  async readProducts(request: ProductRequest, query: ProductQuery, signal: AbortSignal) {
    const value = await this.listings(
      { query: { limit: query.limit, ...(query.q === '' ? {} : { q: query.q }), ...(query.category === '' ? {} : { category: query.category }), ...(query.cursor === undefined ? {} : { cursor: query.cursor }) } },
      this.context(request, signal)
    );
    return this.mapper.page(value);
  }

  async readProduct(request: ProductRequest, productid: string, signal?: AbortSignal) {
    return this.mapper.detail(await this.detail({ path: { productid } }, this.context(request, signal)));
  }

  async readPools(request: ProductRequest, signal: AbortSignal) {
    return this.mapper.pools(await this.pools({ query: { limit: 100 } }, this.context(request, signal)));
  }

  async createProduct(request: ProductCommand, draft: ProductDraft) {
    return this.receipt(await this.catalog.productsCreate({ body: { title: draft.title, category: draft.category, type: draft.type } }, this.command(request)));
  }

  async updateProduct(request: ProductCommand, listing: Listing, draft: Readonly<{ title: string; category: string; status: string }>) {
    const detail = await this.readProduct(request, listing.product_id);
    return this.receipt(await this.catalog.productsUpdate({ path: { productid: listing.product_id }, body: draft }, this.command(request, version(detail.version))));
  }

  async archiveProduct(request: ProductCommand, listing: Listing) {
    const detail = await this.readProduct(request, listing.product_id);
    return this.receipt(await this.catalog.productsArchive({ path: { productid: listing.product_id }, body: {} }, this.command(request, version(detail.version))));
  }

  async changePublication(request: ProductCommand, listings: readonly Listing[], published: boolean) {
    if (listings.length === 1) {
      const listing = listings[0]!;
      const input = { path: { listingid: listing.id }, body: {} } as const;
      const value = published ? await this.catalog.listingsPublish(input, this.command(request, listing.version)) : await this.catalog.listingsUnpublish(input, this.command(request, listing.version));
      return this.receipt(value);
    }
    return this.receipt(await this.catalog.listingsBatch({ body: { ids: listings.map((item) => item.id), action: published ? 'publish' : 'unpublish' } }, this.command(request)));
  }

  async publishPrice(request: ProductCommand, listing: Listing, amountMinor: number) {
    const created = await this.pricing.rulesCreate(
      { body: { priority: 100, kind: 'fixed', condition: { listingId: listing.id, productId: listing.product_id, skuId: listing.sku_id }, effect: { amountMinor, currency: 'CNY', mode: 'fixed' } } },
      this.command(request)
    );
    return this.receipt(await this.pricing.rulesPublish({ path: { ruleid: created.id }, body: {} }, this.command(request, version(created.version))));
  }

  async allocatePool(request: ProductCommand, source: Pool, targetScope: string, kind: 'channel' | 'markup', name: string) {
    return this.receipt(await this.catalog.poolsAllocate({ path: { poolid: source.id }, body: { scope: targetScope, kind, name } }, this.command(request)));
  }

  async changePoolBinding(request: ProductCommand, pool: Pool, mallScope: string, attached: boolean) {
    const input = { path: { poolid: pool.id, scopeid: mallScope }, body: {} } as const;
    return this.receipt(attached ? await this.catalog.poolsAttach(input, this.command(request, pool.version)) : await this.catalog.poolsDetach(input, this.command(request, pool.version)));
  }

  private context(request: ProductRequest, signal?: AbortSignal) {
    return createRequestContext(this.config.clientVersion, { target: 'console', catalogVersion: this.config.catalogVersion, scope: request.scope, accessVersion: request.accessVersion, ...(signal === undefined ? {} : { signal }) });
  }

  private command(request: ProductCommand, expectedVersion?: number) {
    return createRequestContext(this.config.clientVersion, {
      target: 'console',
      catalogVersion: this.config.catalogVersion,
      scope: request.scope,
      accessVersion: request.accessVersion,
      idempotencyKey: request.identity,
      ...(request.csrf === undefined ? {} : { csrfToken: request.csrf }),
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    });
  }

  private receipt(value: unknown): ProductReceipt {
    return this.mapper.receipt(value);
  }
}

function version(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('INVALID_RESOURCE_VERSION');
  return parsed;
}
