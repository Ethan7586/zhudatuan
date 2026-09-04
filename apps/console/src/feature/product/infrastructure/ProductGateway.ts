import { createRequestContext } from '@shop/sdk/context';
import { createFetchCatalog, createFetchCatalogFacetsRead, createFetchCatalogListingsRead, createFetchCatalogPoolsRead, createFetchCatalogProductDetailRead } from '@shop/sdk/catalog';
import { createFetchRuntime } from '@shop/sdk/runtime';
import type { Listing, Pool, PoolAllocationKind, ProductDetailSection, ProductDraft } from '../model/Product';
import type { ProductCommand, ProductImportPort, ProductPort, ProductQuery, ProductRequest } from '../public';
import { ProductMapper } from './ProductMapper';
import { ImportUploadGateway } from '../../../shared/import/ImportUploadGateway';

export interface ProductGatewayConfig {
  readonly apiBaseUrl: string;
  readonly clientVersion: string;
  readonly catalogVersion: string;
}

export class ProductGateway implements ProductPort, ProductImportPort {
  private readonly catalog;
  private readonly listings;
  private readonly facets;
  private readonly detail;
  private readonly pools;
  private readonly runtime;

  constructor(
    private readonly config: ProductGatewayConfig,
    private readonly mapper = new ProductMapper(),
    private readonly uploads = new ImportUploadGateway(config.apiBaseUrl)
  ) {
    this.catalog = createFetchCatalog(config.apiBaseUrl);
    this.listings = createFetchCatalogListingsRead(config.apiBaseUrl);
    this.facets = createFetchCatalogFacetsRead(config.apiBaseUrl);
    this.detail = createFetchCatalogProductDetailRead(config.apiBaseUrl);
    this.pools = createFetchCatalogPoolsRead(config.apiBaseUrl);
    this.runtime = createFetchRuntime(config.apiBaseUrl);
  }

  async readProducts(request: ProductRequest, query: ProductQuery, signal: AbortSignal) {
    const value = await this.listings(
      {
        query: {
          limit: query.limit,
          ...(query.q === '' ? {} : { q: query.q }),
          ...(query.category === '' ? {} : { category: query.category }),
          ...(query.supplier === '' ? {} : { supplier: query.supplier }),
          ...(query.mall === '' ? {} : { mall: query.mall }),
          ...(query.status === '' ? {} : { status: query.status }),
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        },
      },
      this.context(request, signal)
    );
    return this.mapper.page(value);
  }

  async readFacets(request: ProductRequest, query: Readonly<{ q: string }>, signal: AbortSignal) {
    return this.mapper.facets(await this.facets({ query: query.q === '' ? {} : { q: query.q } }, this.context(request, signal)));
  }

  async readProduct(request: ProductRequest, productid: string, section: ProductDetailSection, signal?: AbortSignal) {
    return this.mapper.detail(await this.detail({ path: { productid }, query: { section } }, this.context(request, signal)));
  }

  async readPools(request: ProductRequest, signal: AbortSignal) {
    return this.mapper.pools(await this.pools({ query: { limit: 100 } }, this.context(request, signal)));
  }

  async createProduct(request: ProductCommand, draft: ProductDraft) {
    const body = {
      title: draft.title,
      category: draft.category,
      ...(draft.owner === undefined ? {} : { owner: draft.owner }),
      ...(draft.brand === undefined ? {} : { brand: draft.brand }),
      ...(draft.type === undefined ? {} : { type: draft.type }),
      ...(draft.attributes === undefined ? {} : { attributes: draft.attributes }),
    };
    return this.catalog.productsCreate({ body }, this.command(request));
  }

  async updateProduct(request: ProductCommand, listing: Listing, expectedVersion: number, draft: Parameters<ProductPort['updateProduct']>[3]) {
    const body = {
      ...(draft.title === undefined ? {} : { title: draft.title }),
      ...(draft.category === undefined ? {} : { category: draft.category }),
      ...(draft.attributes === undefined ? {} : { attributes: draft.attributes }),
      ...(draft.status === undefined ? {} : { status: draft.status }),
    };
    return this.catalog.productsUpdate({ path: { productid: productId(listing) }, body }, this.command(request, expectedVersion));
  }

  async archiveProduct(request: ProductCommand, listing: Listing, expectedVersion: number) {
    return this.catalog.productsArchive({ path: { productid: productId(listing) }, body: {} }, this.command(request, expectedVersion));
  }

  async changePublication(request: ProductCommand, listings: readonly Listing[], published: boolean) {
    if (listings.length !== 1) throw new Error('VALIDATION_FAILED');
    const listing = listings[0]!;
    const input = { path: { listingid: listing.id }, body: {} } as const;
    return published ? this.catalog.listingsPublish(input, this.command(request, version(listing.version))) : this.catalog.listingsUnpublish(input, this.command(request, version(listing.version)));
  }

  async previewProductBatch(request: ProductCommand, listings: readonly Listing[], action: import('../model/Product').ProductBatchAction) {
    return this.mapper.batch(await this.catalog.listingsBatch({ body: { phase: 'preview', items: batchItems(listings), action } }, this.command(request)));
  }

  async executeProductBatch(request: ProductCommand, listings: readonly Listing[], action: import('../model/Product').ProductBatchAction, previewHash: string) {
    return this.mapper.batch(await this.catalog.listingsBatch({ body: { phase: 'execute', items: batchItems(listings), action, previewHash } }, this.command(request)));
  }

  async publishPrice(request: ProductCommand, listing: Listing, amountMinor: number, expectedVersion: number) {
    return this.catalog.listingsPriceSet({ path: { listingid: listing.id }, body: { amountMinor, currency: 'CNY' } }, this.command(request, expectedVersion));
  }

  async changeListingPool(request: ProductCommand, listing: Listing, pool: string | null) {
    return this.catalog.listingsPoolSet({ path: { listingid: listing.id }, body: { pool } }, this.command(request, version(listing.version)));
  }

  async allocatePool(request: ProductCommand, source: Pool, targetScope: string, kind: PoolAllocationKind, name: string) {
    return this.catalog.poolsAllocate({ path: { poolid: source.id }, body: { scope: targetScope, kind, name } }, this.command(request));
  }

  async changePoolBinding(request: ProductCommand, pool: Pool, mallScope: string, attached: boolean) {
    const input = { path: { poolid: pool.id, scopeid: mallScope }, body: {} } as const;
    return attached ? this.catalog.poolsAttach(input, this.command(request, pool.version)) : this.catalog.poolsDetach(input, this.command(request, pool.version));
  }

  async createProductImport(request: ProductCommand, file: File, progress?: (processed: number) => void) {
    const uploadContext = { scope: request.scope, session: { accessVersion: request.accessVersion, ...(request.csrf === undefined ? {} : { csrf: request.csrf }) } } as const;
    const uploaded = await this.uploads.upload(uploadContext, file, undefined, progress, request.identity);
    const created = await this.catalog.importsCreate({ body: { objectRef: uploaded.objectRef, sha256: uploaded.sha256, fileName: uploaded.fileName } }, this.command(request));
    return this.readProductImport(request, created.id);
  }

  async readProductImport(request: ProductRequest, id: string, signal?: AbortSignal) {
    const task = await this.runtime.importsRead({ path: { importid: id } }, this.context(request, signal));
    const detail = task.downloadAvailable || task.validationErrors > 0 || task.state === 'failed' ? await this.catalog.importsRead({ path: { importid: id } }, this.context(request, signal)) : undefined;
    return this.mapper.importTask(task, detail);
  }

  async confirmProductImport(request: ProductCommand, task: import('../model/ProductImport').ProductImport) {
    return this.mapper.importTask(await this.runtime.importsConfirm({ path: { importid: task.id }, body: { previewHash: task.previewHash! } }, this.command(request, task.version)));
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
}

function batchItems(listings: readonly Listing[]) {
  return listings.map(({ id, version: value }) => ({ id, expectedVersion: version(value) }));
}

function productId(listing: Listing): string {
  if (typeof listing.product_id !== 'string' || listing.product_id === '') throw new Error('VALIDATION_FAILED');
  return listing.product_id;
}

function version(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('VALIDATION_FAILED');
  return parsed;
}
