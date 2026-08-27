<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import type { CatalogSource, JsonObject, PriceSource, ProviderCallContext, ProviderPorts, SourceSkuKey } from '@shop/contract';
import { Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { CakeuncleClient, CAKEUNCLE_VOUCHER_ENDPOINTS, type CakeuncleInvocation } from '@shop/vendorcakeuncle';
import { FoodvoucherMapper } from './Mapper';
import { definition } from './manifest';

const PRODUCTS_OPERATION = 'foodvoucher.products';

export interface FoodvoucherClient {
  invoke(context: ProviderCallContext, invocation: CakeuncleInvocation): Promise<JsonObject>;
}

export function createFoodvoucherPorts(client: FoodvoucherClient,
  mapper = new FoodvoucherMapper()): Pick<ProviderPorts, 'catalog' | 'price'> {
  return Object.freeze({ catalog: catalog(client, mapper), price: price(client, mapper) });
}
=======
import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
import { definition } from './manifest';
=======
import type { CatalogSource, JsonObject, PriceSource, ProviderCallContext, ProviderPorts, SourceSkuKey } from '@shop/contract';
import { Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { CakeuncleClient, CAKEUNCLE_VOUCHER_ENDPOINTS, type CakeuncleInvocation } from '@shop/vendorcakeuncle';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { FoodvoucherMapper } from './Mapper';
import { definition } from './manifest';

<<<<<<< HEAD
const operations = Object.freeze({ catalog: 'voucher.product.pull', order: 'voucher.issue', cancel: 'voucher.void', refund: 'voucher.refund.submit', statement: 'voucher.statement.pull', verification: 'voucher.verify' });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
const PRODUCTS_OPERATION = 'foodvoucher.products';

export interface FoodvoucherClient {
  invoke(context: ProviderCallContext, invocation: CakeuncleInvocation): Promise<JsonObject>;
}

export function createFoodvoucherPorts(client: FoodvoucherClient,
  mapper = new FoodvoucherMapper()): Pick<ProviderPorts, 'catalog' | 'price'> {
  return Object.freeze({ catalog: catalog(client, mapper), price: price(client, mapper) });
}
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
import { definition } from './manifest';
import { FoodvoucherMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'voucher.product.pull', order: 'voucher.issue', cancel: 'voucher.void', refund: 'voucher.refund.submit', statement: 'voucher.statement.pull', verification: 'voucher.verify' });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

export const FoodvoucherProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(FoodvoucherProvider, installation);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const connection = requireConnection(installation);
    if (connection.endpoints[connection.healthOperation] !== CAKEUNCLE_VOUCHER_ENDPOINTS.products) {
      throw new Error('FOODVOUCHER_HEALTH_ENDPOINT_INVALID');
    }
    const client = new CakeuncleClient(connection);
    return new Provider(installation.manifest, client, createFoodvoucherPorts(client));
<<<<<<< HEAD
  },
});

function catalog(client: FoodvoucherClient, mapper: FoodvoucherMapper): CatalogSource {
  return { async pullCatalog(context, cursor) {
    if (cursor !== undefined) throw new Error('FOODVOUCHER_CURSOR_UNSUPPORTED');
    const products = mapper.products(await list(client, context));
    return Object.freeze({
      records: Object.freeze(products.map(({ externalId, version, payload }) => Object.freeze({ externalId, version, payload }))),
      errors: Object.freeze([]),
      complete: true,
    });
  } };
}

function price(client: FoodvoucherClient, mapper: FoodvoucherMapper): PriceSource {
  return { async pullPrice(context, keys) {
    if (keys.length === 0) return Object.freeze({ records: Object.freeze([]) });
    const requested = uniqueIds(keys);
    const indexed = new Map(mapper.products(await list(client, context)).map((product) => [product.externalId, product]));
    return Object.freeze({ records: Object.freeze(requested.flatMap((externalId) => {
      const product = indexed.get(externalId);
      return product === undefined ? [] : [Object.freeze({ externalId: product.externalId, version: product.version,
        payload: product.payload, amountMinor: product.amountMinor, compareMinor: product.compareMinor })];
    })) });
  } };
}

function list(client: FoodvoucherClient, context: ProviderCallContext): Promise<JsonObject> {
  return client.invoke(context, { operation: PRODUCTS_OPERATION, path: CAKEUNCLE_VOUCHER_ENDPOINTS.products,
    method: 'POST', body: {}, idempotent: true });
}

function uniqueIds(keys: readonly SourceSkuKey[]): readonly string[] {
  const ids: string[] = []; const seen = new Set<string>();
  for (const { externalId } of keys) {
    if (!externalId.trim()) throw new Error('FOODVOUCHER_PRODUCT_ID_INVALID');
    if (!seen.has(externalId)) { seen.add(externalId); ids.push(externalId); }
  }
  return ids;
}
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    const client = createCakeuncleClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new FoodvoucherMapper(), requireConnection(installation).secret));
  },
});
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  },
});

function catalog(client: FoodvoucherClient, mapper: FoodvoucherMapper): CatalogSource {
  return { async pullCatalog(context, cursor) {
    if (cursor !== undefined) throw new Error('FOODVOUCHER_CURSOR_UNSUPPORTED');
    const products = mapper.products(await list(client, context));
    return Object.freeze({
      records: Object.freeze(products.map(({ externalId, version, payload }) => Object.freeze({ externalId, version, payload }))),
      errors: Object.freeze([]),
      complete: true,
    });
  } };
}

function price(client: FoodvoucherClient, mapper: FoodvoucherMapper): PriceSource {
  return { async pullPrice(context, keys) {
    if (keys.length === 0) return Object.freeze({ records: Object.freeze([]) });
    const requested = uniqueIds(keys);
    const indexed = new Map(mapper.products(await list(client, context)).map((product) => [product.externalId, product]));
    return Object.freeze({ records: Object.freeze(requested.flatMap((externalId) => {
      const product = indexed.get(externalId);
      return product === undefined ? [] : [Object.freeze({ externalId: product.externalId, version: product.version,
        payload: product.payload, amountMinor: product.amountMinor, compareMinor: product.compareMinor })];
    })) });
  } };
}

function list(client: FoodvoucherClient, context: ProviderCallContext): Promise<JsonObject> {
  return client.invoke(context, { operation: PRODUCTS_OPERATION, path: CAKEUNCLE_VOUCHER_ENDPOINTS.products,
    method: 'POST', body: {}, idempotent: true });
}

function uniqueIds(keys: readonly SourceSkuKey[]): readonly string[] {
  const ids: string[] = []; const seen = new Set<string>();
  for (const { externalId } of keys) {
    if (!externalId.trim()) throw new Error('FOODVOUCHER_PRODUCT_ID_INVALID');
    if (!seen.has(externalId)) { seen.add(externalId); ids.push(externalId); }
  }
  return ids;
}
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
