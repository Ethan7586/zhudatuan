import { randomUUID } from 'node:crypto';

import type { JsonObject, ProviderCallContext, SourceSkuKey } from '@shop/contract';
import { CAKEUNCLE_PHYSICAL_ENDPOINTS, type CakeuncleClient, type CakeuncleInvocation } from '@shop/vendorcakeuncle';

import { FlowerMapper, type FlowerCategoryPath, type FlowerSpecSnapshot } from './Mapper';

export const FLOWER_CATEGORIES_OPERATION = 'flower.categories';
export const FLOWER_CATEGORY_OPERATION_PREFIX = 'flower.category.';
const PAGE_SIZE = 200;
const MAX_SNAPSHOT_PAGES = 10_000;

export type FlowerConnection = ConstructorParameters<typeof CakeuncleClient>[0];

export interface FlowerTransport {
  invoke(context: ProviderCallContext, invocation: CakeuncleInvocation): Promise<JsonObject>;
  circuitState(): 'closed' | 'open' | 'halfopen';
}

export interface FlowerEndpointConfiguration {
  readonly categoryOperation: string;
  readonly rootCategoryId: string;
}

export class FlowerReadClient {
  constructor(private readonly transport: FlowerTransport, private readonly configuration: FlowerEndpointConfiguration,
    private readonly mapper = new FlowerMapper(), private readonly healthDeadlineMs = 15_000,
    private readonly now: () => number = Date.now) {}

  async health(): Promise<boolean> {
    const id = randomUUID();
    try {
      const categories = await this.categories({ tenantId: 'health', requestId: id, traceId: id,
        deadline: this.now() + this.healthDeadlineMs });
      this.mapper.leafPaths(categories, this.configuration.rootCategoryId);
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
    const leafComplete = position.page * PAGE_SIZE >= page.total;
    const nextCursor = leafComplete
      ? paths[position.pathIndex + 1] === undefined ? undefined : encodeCursor(paths[position.pathIndex + 1]!.leafId, 1)
      : encodeCursor(position.path.leafId, position.page + 1);
    return this.mapper.catalog(page, nextCursor === undefined, nextCursor);
  }

  async pullPrice(context: ProviderCallContext, keys: readonly SourceSkuKey[]) {
    const externalIds = requestedKeys(keys);
    if (!externalIds.length) return this.mapper.price([], new Map(), new Date(this.now()).toISOString());
    const snapshots = await this.snapshot(context);
    return this.mapper.price(externalIds, snapshots, new Date(this.now()).toISOString());
  }

  async pullStock(context: ProviderCallContext, keys: readonly SourceSkuKey[]) {
    const externalIds = requestedKeys(keys);
    if (!externalIds.length) return this.mapper.stock([], new Map(), new Date(this.now()).toISOString());
    const snapshots = await this.snapshot(context);
    return this.mapper.stock(externalIds, snapshots, new Date(this.now()).toISOString());
  }

  private async snapshot(context: ProviderCallContext): Promise<ReadonlyMap<string, FlowerSpecSnapshot>> {
    const paths = await this.paths(context);
    const snapshots = new Map<string, FlowerSpecSnapshot>();
    let pages = 0;
    for (const path of paths) {
      let pageNumber = 1;
      let expectedTotal: number | undefined;
      while (true) {
        pages += 1;
        if (pages > MAX_SNAPSHOT_PAGES) throw new Error('FLOWER_SNAPSHOT_PAGE_LIMIT');
        const page = await this.productPage(context, path, pageNumber);
        assertPage(page.productCount, page.total, pageNumber);
        if (expectedTotal === undefined) expectedTotal = page.total;
        else if (page.total !== expectedTotal) throw new Error('FLOWER_PRODUCTS_TOTAL_CHANGED');
        page.specs.forEach((snapshot) => {
          if (snapshots.has(snapshot.externalId)) throw new Error(`FLOWER_SPEC_DUPLICATE:${snapshot.externalId}`);
          snapshots.set(snapshot.externalId, snapshot);
        });
        if (pageNumber * PAGE_SIZE >= page.total) break;
        pageNumber += 1;
      }
    }
    return snapshots;
  }

  private async paths(context: ProviderCallContext): Promise<readonly FlowerCategoryPath[]> {
    return this.mapper.leafPaths(await this.categories(context), this.configuration.rootCategoryId);
  }

  private async categories(context: ProviderCallContext) {
    const response = await this.transport.invoke(context, {
      operation: FLOWER_CATEGORIES_OPERATION,
      path: CAKEUNCLE_PHYSICAL_ENDPOINTS.categories,
      method: 'POST',
      encoding: 'json',
      body: {},
      idempotent: true,
    });
    return this.mapper.categories(response);
  }

  private async productPage(context: ProviderCallContext, path: FlowerCategoryPath, page: number) {
    const response = await this.transport.invoke(context, {
      operation: this.configuration.categoryOperation,
      path: CAKEUNCLE_PHYSICAL_ENDPOINTS.products,
      method: 'POST',
      encoding: 'json',
      body: Object.freeze({ page: String(page), size: String(PAGE_SIZE), ...path.request }),
      idempotent: true,
    });
    return this.mapper.productPage(response, path);
  }
}

export function flowerEndpointConfiguration(connection: FlowerConnection): FlowerEndpointConfiguration {
  if (connection.healthOperation !== FLOWER_CATEGORIES_OPERATION ||
    connection.endpoints[FLOWER_CATEGORIES_OPERATION] !== CAKEUNCLE_PHYSICAL_ENDPOINTS.categories) {
    throw new Error('FLOWER_CATEGORIES_ENDPOINT_INVALID');
  }
  const matches = Object.entries(connection.endpoints)
    .filter(([operation]) => operation.startsWith(FLOWER_CATEGORY_OPERATION_PREFIX));
  if (matches.length !== 1) throw new Error('FLOWER_ROOT_CATEGORY_CONFIGURATION_INVALID');
  const [operation, endpoint] = matches[0]!;
  const rootCategoryId = operation.slice(FLOWER_CATEGORY_OPERATION_PREFIX.length);
  if (!/^[1-9]\d*$/.test(rootCategoryId) || endpoint !== CAKEUNCLE_PHYSICAL_ENDPOINTS.products) {
    throw new Error('FLOWER_ROOT_CATEGORY_CONFIGURATION_INVALID');
  }
  return Object.freeze({ categoryOperation: operation, rootCategoryId });
}

export function createFlowerReadClient(client: CakeuncleClient, connection: FlowerConnection): FlowerReadClient {
  return new FlowerReadClient(client, flowerEndpointConfiguration(connection), new FlowerMapper(),
    connection.limits.totalDeadlineMs);
}

function decodeCursor(cursor: string | undefined, paths: readonly FlowerCategoryPath[]) {
  if (cursor === undefined) return Object.freeze({ pathIndex: 0, path: paths[0]!, page: 1 });
  const match = /^([1-9]\d*):([1-9]\d*)$/.exec(cursor);
  if (!match) throw new Error('FLOWER_CATALOG_CURSOR_INVALID');
  const pathIndex = paths.findIndex(({ leafId }) => leafId === match[1]);
  const page = Number(match[2]);
  if (pathIndex < 0 || !Number.isSafeInteger(page)) throw new Error('FLOWER_CATALOG_CURSOR_INVALID');
  return Object.freeze({ pathIndex, path: paths[pathIndex]!, page });
}

function encodeCursor(leafId: string, page: number): string { return `${leafId}:${page}`; }

function requestedKeys(keys: readonly SourceSkuKey[]): readonly string[] {
  const externalIds = keys.map(({ externalId }) => {
    if (!/^[1-9]\d*$/.test(externalId)) throw new Error('FLOWER_SPEC_KEY_INVALID');
    return externalId;
  });
  if (new Set(externalIds).size !== externalIds.length) throw new Error('FLOWER_SPEC_KEY_DUPLICATE');
  return Object.freeze(externalIds);
}

function assertPage(productCount: number, total: number, page: number): void {
  if (productCount > PAGE_SIZE) throw new Error('FLOWER_PRODUCTS_PAGE_SIZE_INVALID');
  if (total > 0 && productCount === 0 && (page - 1) * PAGE_SIZE < total) {
    throw new Error('FLOWER_PRODUCTS_PAGE_INCOMPLETE');
  }
}
