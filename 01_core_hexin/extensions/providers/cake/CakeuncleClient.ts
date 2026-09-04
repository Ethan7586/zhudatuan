import { randomUUID } from 'node:crypto';
import type { CatalogSource, JsonObject, PriceSource, ProviderCallContext, SourceSkuKey, StockSource } from '@shop/contract';
import { CAKEUNCLE_PHYSICAL_ENDPOINTS, type CakeuncleClient, type CakeuncleInvocation } from '@shop/vendorcakeuncle';
import type { VendorConnection } from '@shop/vendorcore';
import { cakeLeafPaths, catalogBatch, parseCakeCategories, parseCakeProductPage, priceBatch, stockBatch,
  type CakeCategoryPath, type CakeSpecSnapshot } from './Mapper';

export const CAKE_CATEGORIES_OPERATION = 'cake.categories';
export const CAKE_CATEGORY_OPERATION_PREFIX = 'cake.category.';
const PAGE_SIZE = 200;
const MAX_SNAPSHOT_PAGES = 10_000;

export interface CakeuncleTransport {
  invoke(context: ProviderCallContext, invocation: CakeuncleInvocation): Promise<JsonObject>;
  circuitState(): 'closed' | 'open' | 'halfopen';
}

export interface CakeEndpointConfiguration {
  readonly categoryOperation: string;
  readonly rootCategoryId: string;
}

export class CakeReadClient implements CatalogSource, PriceSource, StockSource {
  constructor(private readonly transport: CakeuncleTransport, private readonly configuration: CakeEndpointConfiguration,
    private readonly healthDeadlineMs = 15_000, private readonly now: () => number = Date.now) {}

  async health(): Promise<boolean> {
    const id = randomUUID();
    try {
      const categories = await this.categories({ tenantId: 'health', requestId: id, traceId: id,
        deadline: this.now() + this.healthDeadlineMs });
      cakeLeafPaths(categories, this.configuration.rootCategoryId);
      return true;
    } catch {
      return false;
    }
  }

  circuitState(): 'closed' | 'open' | 'halfopen' { return this.transport.circuitState(); }

  async pullCatalog(context: ProviderCallContext, cursor?: string) {
    const paths = await this.paths(context);
    const position = decodeCursor(cursor, paths);
    const page = await this.productPage(context, position.path, position.page);
    assertPage(page.productCount, page.total, position.page);
    const categoryComplete = position.page * PAGE_SIZE >= page.total;
    const nextCursor = categoryComplete
      ? paths[position.pathIndex + 1] === undefined ? undefined : encodeCursor(paths[position.pathIndex + 1]!.leafId, 1)
      : encodeCursor(position.path.leafId, position.page + 1);
    return catalogBatch(page, nextCursor === undefined, nextCursor);
  }

  async pullPrice(context: ProviderCallContext, keys: readonly SourceSkuKey[]) {
    const externalIds = requestedKeys(keys);
    const snapshots = await this.snapshot(context);
    return priceBatch(externalIds, snapshots, new Date(this.now()).toISOString());
  }

  async pullStock(context: ProviderCallContext, keys: readonly SourceSkuKey[]) {
    const externalIds = requestedKeys(keys);
    const snapshots = await this.snapshot(context);
    return stockBatch(externalIds, snapshots, new Date(this.now()).toISOString());
  }

  private async snapshot(context: ProviderCallContext): Promise<ReadonlyMap<string, CakeSpecSnapshot>> {
    const paths = await this.paths(context);
    const snapshots = new Map<string, CakeSpecSnapshot>();
    let pages = 0;
    for (const path of paths) {
      let pageNumber = 1;
      let expectedTotal: number | undefined;
      while (true) {
        pages += 1;
        if (pages > MAX_SNAPSHOT_PAGES) throw new Error('CAKE_SNAPSHOT_PAGE_LIMIT');
        const page = await this.productPage(context, path, pageNumber);
        assertPage(page.productCount, page.total, pageNumber);
        if (expectedTotal === undefined) expectedTotal = page.total;
        else if (page.total !== expectedTotal) throw new Error('CAKE_PRODUCTS_TOTAL_CHANGED');
        page.specs.forEach((snapshot) => {
          if (snapshots.has(snapshot.externalId)) throw new Error(`CAKE_SPEC_DUPLICATE:${snapshot.externalId}`);
          snapshots.set(snapshot.externalId, snapshot);
        });
        if (pageNumber * PAGE_SIZE >= page.total) break;
        pageNumber += 1;
      }
    }
    return snapshots;
  }

  private async paths(context: ProviderCallContext): Promise<readonly CakeCategoryPath[]> {
    return cakeLeafPaths(await this.categories(context), this.configuration.rootCategoryId);
  }

  private async categories(context: ProviderCallContext) {
    const response = await this.transport.invoke(context, {
      operation: CAKE_CATEGORIES_OPERATION,
      method: 'POST',
      encoding: 'json',
      body: {},
      idempotent: true,
    });
    return parseCakeCategories(response);
  }

  private async productPage(context: ProviderCallContext, path: CakeCategoryPath, page: number) {
    const response = await this.transport.invoke(context, {
      operation: this.configuration.categoryOperation,
      method: 'POST',
      encoding: 'json',
      body: Object.freeze({ page: String(page), size: String(PAGE_SIZE), ...path.request }),
      idempotent: true,
    });
    return parseCakeProductPage(response, path);
  }
}

export function cakeEndpointConfiguration(connection: VendorConnection): CakeEndpointConfiguration {
  if (connection.healthOperation !== CAKE_CATEGORIES_OPERATION ||
    connection.endpoints[CAKE_CATEGORIES_OPERATION] !== CAKEUNCLE_PHYSICAL_ENDPOINTS.categories) {
    throw new Error('CAKE_CATEGORIES_ENDPOINT_INVALID');
  }
  const matches = Object.entries(connection.endpoints).filter(([operation]) => operation.startsWith(CAKE_CATEGORY_OPERATION_PREFIX));
  if (matches.length !== 1) throw new Error('CAKE_ROOT_CATEGORY_CONFIGURATION_INVALID');
  const [operation, endpoint] = matches[0]!;
  const rootCategoryId = operation.slice(CAKE_CATEGORY_OPERATION_PREFIX.length);
  if (!/^[1-9]\d*$/.test(rootCategoryId) || endpoint !== CAKEUNCLE_PHYSICAL_ENDPOINTS.products) {
    throw new Error('CAKE_ROOT_CATEGORY_CONFIGURATION_INVALID');
  }
  return Object.freeze({ categoryOperation: operation, rootCategoryId });
}

export function createCakeReadClient(client: CakeuncleClient, connection: VendorConnection): CakeReadClient {
  return new CakeReadClient(client, cakeEndpointConfiguration(connection), connection.limits.totalDeadlineMs);
}

function decodeCursor(cursor: string | undefined, paths: readonly CakeCategoryPath[]) {
  if (cursor === undefined) return Object.freeze({ pathIndex: 0, path: paths[0]!, page: 1 });
  const match = /^([1-9]\d*):([1-9]\d*)$/.exec(cursor);
  if (!match) throw new Error('CAKE_CATALOG_CURSOR_INVALID');
  const pathIndex = paths.findIndex(({ leafId }) => leafId === match[1]);
  const page = Number(match[2]);
  if (pathIndex < 0 || !Number.isSafeInteger(page)) throw new Error('CAKE_CATALOG_CURSOR_INVALID');
  return Object.freeze({ pathIndex, path: paths[pathIndex]!, page });
}

function encodeCursor(leafId: string, page: number): string { return `${leafId}:${page}`; }

function requestedKeys(keys: readonly SourceSkuKey[]): readonly string[] {
  const externalIds = keys.map(({ externalId }) => {
    if (!/^\d+$/.test(externalId)) throw new Error('CAKE_SPEC_KEY_INVALID');
    return externalId;
  });
  if (new Set(externalIds).size !== externalIds.length) throw new Error('CAKE_SPEC_KEY_DUPLICATE');
  return Object.freeze(externalIds);
}

function assertPage(productCount: number, total: number, page: number): void {
  if (productCount > PAGE_SIZE) throw new Error('CAKE_PRODUCTS_PAGE_SIZE_INVALID');
  if (page > Math.max(1, Math.ceil(total / PAGE_SIZE))) throw new Error('CAKE_PRODUCTS_PAGE_OUT_OF_RANGE');
  if (total > 0 && productCount === 0 && (page - 1) * PAGE_SIZE < total) throw new Error('CAKE_PRODUCTS_PAGE_INCOMPLETE');
}
