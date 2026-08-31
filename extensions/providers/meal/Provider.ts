<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { randomUUID } from 'node:crypto';
import type { CatalogSource, JsonObject, JsonValue, PriceSource, ProviderCallContext, ProviderPorts } from '@shop/contract';
import { Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { CAKEUNCLE_MEAL_BRANDS, createCakeuncleClient, type CakeuncleClient } from '@shop/vendorcakeuncle';
import type { VendorConnection } from '@shop/vendorcore';
<<<<<<< HEAD
import { definition } from './manifest';
import { mealCatalogScopes, type MealCatalogScope } from './BrandCatalog';
import { MealMapper, parseMealExternalId } from './Mapper';

export interface MealTransport {
  invoke: CakeuncleClient['invoke'];
}
=======
import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { definition } from './manifest';
import { mealCatalogScopes, type MealCatalogScope } from './BrandCatalog';
import { MealMapper, parseMealExternalId } from './Mapper';

<<<<<<< HEAD
const operations = Object.freeze({ catalog: 'meal.menu.pull', price: 'meal.price.pull', stock: 'meal.inventory.pull', order: 'meal.order.submit', cancel: 'meal.order.cancel', tracking: 'meal.pickup.query', refund: 'meal.refund.submit', statement: 'meal.statement.pull', verification: 'meal.pickup.verify' });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
export interface MealTransport {
  invoke: CakeuncleClient['invoke'];
}
>>>>>>> 018b2a71 (chore(release): capture current production source)

export const MealProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(MealProvider, installation);
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const connection = requireConnection(installation);
    const scopes = mealCatalogScopes(connection);
    if (connection.endpoints[connection.healthOperation] !== CAKEUNCLE_MEAL_BRANDS[scopes[0]!.brand].menu) {
      throw new Error('MEAL_HEALTH_ENDPOINT_INVALID');
    }
    const client = createCakeuncleClient(connection);
    return new Provider(installation.manifest, mealProbe(client, connection, scopes[0]!),
      createMealPorts(client, connection, undefined, undefined, scopes));
<<<<<<< HEAD
  },
});

export function createMealPorts(client: MealTransport, connection: VendorConnection, mapper = new MealMapper(),
  now: () => Date = () => new Date(), configuredScopes?: readonly MealCatalogScope[]): Pick<ProviderPorts, 'catalog' | 'price'> {
  const scopes = configuredScopes ?? mealCatalogScopes(connection);
  return Object.freeze({ catalog: catalog(client, scopes, mapper), price: price(client, scopes, mapper, now) });
}

function mealProbe(client: CakeuncleClient, connection: VendorConnection, scope: MealCatalogScope) {
  return Object.freeze({
    async health(): Promise<boolean> {
      const deadline = Date.now() + connection.limits.totalDeadlineMs;
      const context: ProviderCallContext = { tenantId: 'health', requestId: randomUUID(), traceId: randomUUID(), deadline };
      try {
        await client.invoke(context, { operation: scope.operation, path: CAKEUNCLE_MEAL_BRANDS[scope.brand].menu,
          encoding: 'form', idempotent: true, body: { store_code: scope.storeCode } });
        return true;
      } catch { return false; }
    },
    circuitState: () => client.circuitState(),
  });
}

function catalog(client: MealTransport, scopes: readonly MealCatalogScope[], mapper: MealMapper): CatalogSource {
  return { async pullCatalog(context, cursor) {
    const index = cursor === undefined ? 0 : cursorIndex(cursor, scopes.length);
    if (index === scopes.length) return { records: [], errors: [], complete: true };
    const scope = scopes[index]!;
    const value = await client.invoke(context, { operation: scope.operation, path: CAKEUNCLE_MEAL_BRANDS[scope.brand].menu,
      encoding: 'form', idempotent: true, body: { store_code: scope.storeCode } });
    const mapped = mapper.catalog(scope.brand, scope.storeCode, data(value));
    const complete = index + 1 >= scopes.length;
    return Object.freeze({ ...mapped, complete, ...(complete ? {} : { nextCursor: String(index + 1) }) });
  } };
}

function price(client: MealTransport, scopes: readonly MealCatalogScope[], mapper: MealMapper, now: () => Date): PriceSource {
  return { async pullPrice(context, keys) {
    const observedAt = now().toISOString();
    const requested = new Map(keys.map(({ externalId }) => [externalId, parseMealExternalId(externalId)]));
    if (requested.size !== keys.length) throw new Error('MEAL_PRICE_KEY_DUPLICATE');
    const records = new Map<string, JsonObject>();
    for (const scope of scopes) {
      const scoped = [...requested.entries()].filter(([, item]) => item.brand === scope.brand && item.storeCode === scope.storeCode);
      if (!scoped.length) continue;
      const value = await client.invoke(context, { operation: scope.operation, path: CAKEUNCLE_MEAL_BRANDS[scope.brand].menu,
        encoding: 'form', idempotent: true, body: { store_code: scope.storeCode } });
      const indexed = new Map(mapper.prices(scope.brand, scope.storeCode, data(value), observedAt)
        .map((record) => [text(record.externalId, 'MEAL_EXTERNAL_ID_INVALID'), record]));
      scoped.forEach(([externalId]) => {
        const record = indexed.get(externalId);
        if (!record) throw new Error('MEAL_PRICE_PRODUCT_MISSING');
        records.set(externalId, record);
      });
    }
    if (records.size !== requested.size) throw new Error('MEAL_PRICE_SCOPE_INVALID');
    return Object.freeze({ records: Object.freeze([...records.values()]) });
  } };
}

function cursorIndex(value: string, maximum: number): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error('MEAL_CATALOG_CURSOR_INVALID');
  const index = Number(value);
  if (!Number.isSafeInteger(index) || index > maximum) throw new Error('MEAL_CATALOG_CURSOR_INVALID');
  return index;
}

function data(value: JsonObject): JsonValue {
  if (value.data === undefined) throw new Error('MEAL_RESPONSE_DATA_MISSING');
  return value.data;
}

function text(value: JsonValue | undefined, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}
=======
    const client = createCakeuncleClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new MealMapper(), requireConnection(installation).secret));
  },
});
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  },
});

export function createMealPorts(client: MealTransport, connection: VendorConnection, mapper = new MealMapper(),
  now: () => Date = () => new Date(), configuredScopes?: readonly MealCatalogScope[]): Pick<ProviderPorts, 'catalog' | 'price'> {
  const scopes = configuredScopes ?? mealCatalogScopes(connection);
  return Object.freeze({ catalog: catalog(client, scopes, mapper), price: price(client, scopes, mapper, now) });
}

function mealProbe(client: CakeuncleClient, connection: VendorConnection, scope: MealCatalogScope) {
  return Object.freeze({
    async health(): Promise<boolean> {
      const deadline = Date.now() + connection.limits.totalDeadlineMs;
      const context: ProviderCallContext = { tenantId: 'health', requestId: randomUUID(), traceId: randomUUID(), deadline };
      try {
        await client.invoke(context, { operation: scope.operation, path: CAKEUNCLE_MEAL_BRANDS[scope.brand].menu,
          encoding: 'form', idempotent: true, body: { store_code: scope.storeCode } });
        return true;
      } catch { return false; }
    },
    circuitState: () => client.circuitState(),
  });
}

function catalog(client: MealTransport, scopes: readonly MealCatalogScope[], mapper: MealMapper): CatalogSource {
  return { async pullCatalog(context, cursor) {
    const index = cursor === undefined ? 0 : cursorIndex(cursor, scopes.length);
    if (index === scopes.length) return { records: [], errors: [], complete: true };
    const scope = scopes[index]!;
    const value = await client.invoke(context, { operation: scope.operation, path: CAKEUNCLE_MEAL_BRANDS[scope.brand].menu,
      encoding: 'form', idempotent: true, body: { store_code: scope.storeCode } });
    const mapped = mapper.catalog(scope.brand, scope.storeCode, data(value));
    const complete = index + 1 >= scopes.length;
    return Object.freeze({ ...mapped, complete, ...(complete ? {} : { nextCursor: String(index + 1) }) });
  } };
}

function price(client: MealTransport, scopes: readonly MealCatalogScope[], mapper: MealMapper, now: () => Date): PriceSource {
  return { async pullPrice(context, keys) {
    const observedAt = now().toISOString();
    const requested = new Map(keys.map(({ externalId }) => [externalId, parseMealExternalId(externalId)]));
    if (requested.size !== keys.length) throw new Error('MEAL_PRICE_KEY_DUPLICATE');
    const records = new Map<string, JsonObject>();
    for (const scope of scopes) {
      const scoped = [...requested.entries()].filter(([, item]) => item.brand === scope.brand && item.storeCode === scope.storeCode);
      if (!scoped.length) continue;
      const value = await client.invoke(context, { operation: scope.operation, path: CAKEUNCLE_MEAL_BRANDS[scope.brand].menu,
        encoding: 'form', idempotent: true, body: { store_code: scope.storeCode } });
      const indexed = new Map(mapper.prices(scope.brand, scope.storeCode, data(value), observedAt)
        .map((record) => [text(record.externalId, 'MEAL_EXTERNAL_ID_INVALID'), record]));
      scoped.forEach(([externalId]) => {
        const record = indexed.get(externalId);
        if (!record) throw new Error('MEAL_PRICE_PRODUCT_MISSING');
        records.set(externalId, record);
      });
    }
    if (records.size !== requested.size) throw new Error('MEAL_PRICE_SCOPE_INVALID');
    return Object.freeze({ records: Object.freeze([...records.values()]) });
  } };
}

function cursorIndex(value: string, maximum: number): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error('MEAL_CATALOG_CURSOR_INVALID');
  const index = Number(value);
  if (!Number.isSafeInteger(index) || index > maximum) throw new Error('MEAL_CATALOG_CURSOR_INVALID');
  return index;
}

function data(value: JsonObject): JsonValue {
  if (value.data === undefined) throw new Error('MEAL_RESPONSE_DATA_MISSING');
  return value.data;
}

function text(value: JsonValue | undefined, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}
>>>>>>> 018b2a71 (chore(release): capture current production source)
