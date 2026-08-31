<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { createHash } from 'node:crypto';
import type { CatalogBatch, JsonObject, JsonValue, PriceBatch, StockBatch } from '@shop/contract';
import { cakeuncleMinor, cakeuncleNonnegativeInteger } from '@shop/vendorcakeuncle';
export const FLOWER_UNLIMITED_ONHAND = 999_999;
export interface FlowerCategory {
  readonly id: string;
  readonly parentId: string;
  readonly level: 1 | 2 | 3;
  readonly name: string;
}
export interface FlowerCategoryPath {
  readonly leafId: string;
  readonly request: JsonObject;
}
export interface FlowerSpecSnapshot {
  readonly externalId: string;
  readonly version: string;
  readonly payload: JsonObject;
  readonly amountMinor: number;
  readonly compareMinor?: number;
  readonly clearingPriceMinor: number;
  readonly onhand: number;
  readonly unlimited: boolean;
}

export interface FlowerProductPage {
  readonly total: number;
  readonly productCount: number;
  readonly specs: readonly FlowerSpecSnapshot[];
}

/** Strict mapper for the documented physical-product response used by flowers. */
export class FlowerMapper {
  categories(response: JsonObject): readonly FlowerCategory[] {
    success(response, 'FLOWER_CATEGORIES_RESPONSE_INVALID');
    const values = array(response.data, 'FLOWER_CATEGORIES_DATA_INVALID');
    const seen = new Set<string>();
    return Object.freeze(values.map((value) => {
      const source = object(value, 'FLOWER_CATEGORY_INVALID');
      const id = identifier(source.id, 'FLOWER_CATEGORY_ID_INVALID');
      if (seen.has(id)) throw new Error('FLOWER_CATEGORY_DUPLICATE');
      seen.add(id);
      const rawLevel = required(source.level, 'FLOWER_CATEGORY_LEVEL_INVALID');
      if (rawLevel !== '1' && rawLevel !== '2' && rawLevel !== '3') throw new Error('FLOWER_CATEGORY_LEVEL_INVALID');
      return Object.freeze({
        id,
        parentId: identifier(source.parent_id, 'FLOWER_CATEGORY_PARENT_INVALID', true),
        level: Number(rawLevel) as 1 | 2 | 3,
        name: required(source.name, 'FLOWER_CATEGORY_NAME_INVALID'),
      });
    }));
  }

  leafPaths(categories: readonly FlowerCategory[], rootId: string): readonly FlowerCategoryPath[] {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const root = byId.get(rootId);
    if (!root || root.level !== 1 || root.parentId !== '0') throw new Error('FLOWER_ROOT_CATEGORY_INVALID');
    const children = new Map<string, FlowerCategory[]>();
    categories.forEach((category) => {
      const values = children.get(category.parentId) ?? [];
      values.push(category);
      children.set(category.parentId, values);
    });

    const leaves: FlowerCategoryPath[] = [];
    const visit = (category: FlowerCategory, chain: readonly FlowerCategory[], visiting: ReadonlySet<string>): void => {
      if (visiting.has(category.id)) throw new Error('FLOWER_CATEGORY_CYCLE');
      const next = [...chain, category];
      if (category.level !== next.length || next.length > 3) throw new Error('FLOWER_CATEGORY_TREE_INVALID');
      const descendants = (children.get(category.id) ?? []).filter(({ id }) => id !== category.id);
      if (descendants.length === 0) {
        leaves.push(Object.freeze({ leafId: category.id, request: categoryRequest(next) }));
        return;
      }
      const nextVisiting = new Set(visiting).add(category.id);
      descendants.sort(compareCategory).forEach((child) => visit(child, next, nextVisiting));
    };
    visit(root, [], new Set());
    if (!leaves.length) throw new Error('FLOWER_CATEGORY_LEAF_MISSING');
    return Object.freeze(leaves);
  }

  productPage(response: JsonObject, path: FlowerCategoryPath): FlowerProductPage {
    success(response, 'FLOWER_PRODUCTS_RESPONSE_INVALID');
    const data = object(response.data, 'FLOWER_PRODUCTS_DATA_INVALID');
    const total = integer(data.total_num, 'FLOWER_PRODUCTS_TOTAL_INVALID');
    if (total < 0) throw new Error('FLOWER_PRODUCTS_TOTAL_INVALID');
    const products = array(data.products, 'FLOWER_PRODUCTS_INVALID');
    const specs: FlowerSpecSnapshot[] = [];
    const seen = new Set<string>();
    products.forEach((value) => {
      const product = object(value, 'FLOWER_PRODUCT_INVALID');
      assertCategory(product, path.request);
      const productId = identifier(product.product_id, 'FLOWER_PRODUCT_ID_INVALID');
      const productName = required(product.product_name, 'FLOWER_PRODUCT_NAME_INVALID');
      const productSpecs = array(product.specs, 'FLOWER_PRODUCT_SPECS_INVALID');
      if (!productSpecs.length) throw new Error('FLOWER_PRODUCT_SPECS_EMPTY');
      productSpecs.forEach((value) => {
        const spec = object(value, 'FLOWER_SPEC_INVALID');
        const externalId = identifier(spec.spec_id, 'FLOWER_SPEC_ID_INVALID');
        if (seen.has(externalId)) throw new Error('FLOWER_SPEC_DUPLICATE');
        seen.add(externalId);
        specs.push(mapSpec(product, spec, productId, productName, externalId));
      });
    });
    return Object.freeze({ total, productCount: products.length, specs: Object.freeze(specs) });
  }

  catalog(page: FlowerProductPage, complete: boolean, nextCursor?: string): CatalogBatch {
    return Object.freeze({
      records: Object.freeze(page.specs.map(({ externalId, version, payload }) =>
        Object.freeze({ externalId, version, payload }))),
      errors: Object.freeze([]),
      complete,
      ...(nextCursor === undefined ? {} : { nextCursor }),
    });
  }

  price(keys: readonly string[], snapshots: ReadonlyMap<string, FlowerSpecSnapshot>, observedAt: string): PriceBatch {
    return Object.freeze({ records: Object.freeze(keys.map((externalId) => {
      const snapshot = snapshotFor(snapshots, externalId);
      return Object.freeze({ externalId, amountMinor: snapshot.amountMinor,
        ...(snapshot.compareMinor === undefined ? {} : { compareMinor: snapshot.compareMinor }),
        currency: 'CNY', version: snapshot.version, effectiveAt: observedAt });
    })) });
  }

  stock(keys: readonly string[], snapshots: ReadonlyMap<string, FlowerSpecSnapshot>, observedAt: string): StockBatch {
    return Object.freeze({ records: Object.freeze(keys.map((externalId) => {
      const snapshot = snapshotFor(snapshots, externalId);
      return Object.freeze({ externalId, onhand: snapshot.onhand, safety: 0, version: snapshot.version, observedAt,
        ...(snapshot.unlimited ? { unlimited: true } : {}) });
    })) });
  }
}

function mapSpec(product: JsonObject, spec: JsonObject, productId: string, productName: string,
  externalId: string): FlowerSpecSnapshot {
  const amountMinor = cakeuncleMinor(required(spec.price, 'FLOWER_SPEC_PRICE_INVALID'), 'FLOWER_SPEC_PRICE_INVALID');
  const marketMinor = cakeuncleMinor(required(spec.market_price, 'FLOWER_SPEC_MARKET_PRICE_INVALID'), 'FLOWER_SPEC_MARKET_PRICE_INVALID');
  const clearingPriceMinor = cakeuncleMinor(required(spec.clearing_price, 'FLOWER_SPEC_CLEARING_PRICE_INVALID'),
    'FLOWER_SPEC_CLEARING_PRICE_INVALID');
  const stock = stockValue(required(spec.stock, 'FLOWER_SPEC_STOCK_INVALID'));
  const payload = Object.freeze({
    schema: 'cakeuncle.physical-sku.v1',
    provider: 'flower',
    productId,
    specId: externalId,
    productName,
    specName: required(spec.spec_name, 'FLOWER_SPEC_NAME_INVALID'),
    ...(optional(product.brand_id) ? { brandId: optional(product.brand_id)! } : {}),
    ...(optional(product.brand_name) ? { brandName: optional(product.brand_name)! } : {}),
    categoryIds: Object.freeze(['cat_id', 'cat_id2', 'cat_id3'].flatMap((key) => optional(product[key]) ?? [])),
    cityIds: Object.freeze(csv(optional(product.city_ids))),
    labels: Object.freeze(csv(optional(product.label_name))),
    tastes: Object.freeze(csv(optional(spec.tastes))),
    imagePaths: Object.freeze(images(product)),
    ...(optional(spec.gift) ? { gift: optional(spec.gift)! } : {}),
    ...(optional(product.storage) ? { storage: optional(product.storage)! } : {}),
    ...(optional(product.expiry_days) ?
      { expiryDays: cakeuncleNonnegativeInteger(optional(product.expiry_days)!, 'FLOWER_PRODUCT_EXPIRY_INVALID') } : {}),
    supportsGreeting: greeting(product.is_greeting),
    currency: 'CNY',
    amountMinor,
    ...(marketMinor === 0 ? {} : { compareMinor: marketMinor }),
    onhand: stock.onhand,
    unlimited: stock.unlimited,
    charges: Object.freeze(charges(product.charges)),
  }) satisfies JsonObject;
  const version = createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
  return Object.freeze({ externalId, version, payload, amountMinor,
    ...(marketMinor === 0 ? {} : { compareMinor: marketMinor }), clearingPriceMinor,
    onhand: stock.onhand, unlimited: stock.unlimited });
}

function categoryRequest(chain: readonly FlowerCategory[]): JsonObject {
  return Object.freeze(Object.fromEntries(chain.map((category) =>
    [category.level === 1 ? 'cat_id' : `cat_id${category.level}`, category.id])) as JsonObject);
}

function assertCategory(product: JsonObject, request: JsonObject): void {
  for (const key of ['cat_id', 'cat_id2', 'cat_id3']) {
    if (request[key] !== undefined && required(product[key], 'FLOWER_PRODUCT_CATEGORY_INVALID') !== request[key]) {
      throw new Error('FLOWER_PRODUCT_CATEGORY_MISMATCH');
    }
  }
}

function charges(value: JsonValue | undefined): readonly JsonObject[] {
  if (value === undefined || value === null) return [];
  return array(value, 'FLOWER_PRODUCT_CHARGES_INVALID').map((value) => {
    const source = object(value, 'FLOWER_PRODUCT_CHARGE_INVALID');
    return Object.freeze({
      id: identifier(source.id, 'FLOWER_PRODUCT_CHARGE_ID_INVALID'),
      name: required(source.name, 'FLOWER_PRODUCT_CHARGE_NAME_INVALID'),
      amountMinor: cakeuncleMinor(required(source.price, 'FLOWER_PRODUCT_CHARGE_PRICE_INVALID'),
        'FLOWER_PRODUCT_CHARGE_PRICE_INVALID'),
      type: required(source.type, 'FLOWER_PRODUCT_CHARGE_TYPE_INVALID'),
    });
  }).sort((left, right) => compareIdentifiers(String(left.id), String(right.id)));
}

function images(product: JsonObject): readonly string[] {
  const paths: string[] = optional(product.image_path) ? [optional(product.image_path)!] : [];
  for (const key of ['carousel_image', 'detail_image']) {
    const value = product[key];
    if (value === undefined || value === null) continue;
    const source = object(value, 'FLOWER_PRODUCT_IMAGE_INVALID');
    for (const image of [optional(source.m_path), optional(source.l_path), optional(source.s_path)]) {
      if (image) paths.push(...csv(image));
    }
  }
  return sortedUnique(paths);
}

function greeting(value: JsonValue | undefined): boolean {
  const raw = required(value, 'FLOWER_PRODUCT_GREETING_INVALID');
  if (raw === '0') return true;
  if (raw === '1') return false;
  throw new Error('FLOWER_PRODUCT_GREETING_INVALID');
}

function stockValue(value: string): Readonly<{ onhand: number; unlimited: boolean }> {
  if (value === '-9999999') return Object.freeze({ onhand: FLOWER_UNLIMITED_ONHAND, unlimited: true });
  if (value.startsWith('-')) throw new Error('FLOWER_SPEC_STOCK_INVALID');
  return Object.freeze({ onhand: cakeuncleNonnegativeInteger(value, 'FLOWER_SPEC_STOCK_INVALID'), unlimited: false });
}

function snapshotFor(snapshots: ReadonlyMap<string, FlowerSpecSnapshot>, externalId: string): FlowerSpecSnapshot {
  const snapshot = snapshots.get(externalId);
  if (!snapshot) throw new Error(`FLOWER_SPEC_NOT_FOUND:${externalId}`);
  return snapshot;
}

function success(value: JsonObject, code: string): void {
  if (value.code !== 200 && value.code !== '200') throw new Error(code);
}

function object(value: JsonValue | undefined, code: string): JsonObject {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonObject;
}

function array(value: JsonValue | undefined, code: string): readonly JsonValue[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function required(value: JsonValue | undefined, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function optional(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function identifier(value: JsonValue | undefined, code: string, zero = false): string {
  const result = required(value, code);
  if (!(zero ? /^(0|[1-9]\d*)$/.test(result) : /^[1-9]\d*$/.test(result))) throw new Error(code);
  return result;
}

function integer(value: JsonValue | undefined, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(code);
  return value;
}

function csv(value: string | undefined): readonly string[] {
  if (!value) return [];
  return sortedUnique(value.split(',').map((item) => item.trim()).filter(Boolean));
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

function compareCategory(left: FlowerCategory, right: FlowerCategory): number {
  return compareIdentifiers(left.id, right.id);
}

function compareIdentifiers(left: string, right: string): number {
  return left.length === right.length ? left.localeCompare(right, 'en') : left.length - right.length;
}
<<<<<<< HEAD
=======
export { CanonicalSourceMapper as FlowerMapper } from '@shop/providercore';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
