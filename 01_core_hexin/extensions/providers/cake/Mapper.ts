import { createHash } from 'node:crypto';
import type { CatalogBatch, JsonObject, JsonValue, PriceBatch, StockBatch } from '@shop/contract';
import { cakeuncleMinor, cakeuncleNonnegativeInteger } from '@shop/vendorcakeuncle';

export const CAKEUNCLE_UNLIMITED_ONHAND = 999_999;

export interface CakeCategory {
  readonly id: string;
  readonly parentId: string;
  readonly level: 1 | 2 | 3;
  readonly name: string;
}

export interface CakeCategoryPath {
  readonly leafId: string;
  readonly request: JsonObject;
}

export interface CakeSpecSnapshot {
  readonly externalId: string;
  readonly version: string;
  readonly payload: JsonObject;
  readonly amountMinor: number;
  readonly compareMinor?: number;
  readonly clearingPriceMinor: number;
  readonly onhand: number;
  readonly unlimited: boolean;
}

export interface CakeProductPage {
  readonly total: number;
  readonly productCount: number;
  readonly specs: readonly CakeSpecSnapshot[];
}

export function parseCakeCategories(response: JsonObject): readonly CakeCategory[] {
  const values = array(response.data, 'CAKE_CATEGORIES_DATA_INVALID');
  const seen = new Set<string>();
  return Object.freeze(values.map((value) => {
    const source = object(value, 'CAKE_CATEGORY_INVALID');
    const id = identifier(source.id, 'CAKE_CATEGORY_ID_INVALID');
    if (seen.has(id)) throw new Error('CAKE_CATEGORY_DUPLICATE');
    seen.add(id);
    const rawLevel = required(source.level, 'CAKE_CATEGORY_LEVEL_INVALID');
    if (rawLevel !== '1' && rawLevel !== '2' && rawLevel !== '3') throw new Error('CAKE_CATEGORY_LEVEL_INVALID');
    return Object.freeze({
      id,
      parentId: required(source.parent_id, 'CAKE_CATEGORY_PARENT_INVALID'),
      level: Number(rawLevel) as 1 | 2 | 3,
      name: required(source.name, 'CAKE_CATEGORY_NAME_INVALID'),
    });
  }));
}

export function cakeLeafPaths(categories: readonly CakeCategory[], rootId: string): readonly CakeCategoryPath[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const root = byId.get(rootId);
  if (!root || root.level !== 1) throw new Error('CAKE_ROOT_CATEGORY_INVALID');
  const children = new Map<string, CakeCategory[]>();
  categories.forEach((category) => {
    const entries = children.get(category.parentId) ?? [];
    entries.push(category);
    children.set(category.parentId, entries);
  });
  const leaves: CakeCategoryPath[] = [];
  const visit = (category: CakeCategory, chain: readonly CakeCategory[], visiting: ReadonlySet<string>): void => {
    if (visiting.has(category.id)) throw new Error('CAKE_CATEGORY_CYCLE');
    const nextChain = [...chain, category];
    const expectedLevel = nextChain.length;
    if (category.level !== expectedLevel || expectedLevel > 3) throw new Error('CAKE_CATEGORY_TREE_INVALID');
    const descendants = (children.get(category.id) ?? []).filter((candidate) => candidate.id !== category.id);
    if (descendants.length === 0) {
      leaves.push(Object.freeze({ leafId: category.id, request: categoryRequest(nextChain) }));
      return;
    }
    const nextVisiting = new Set(visiting).add(category.id);
    descendants.sort(compareCategory).forEach((child) => visit(child, nextChain, nextVisiting));
  };
  visit(root, [], new Set());
  if (leaves.length === 0) throw new Error('CAKE_CATEGORY_LEAF_MISSING');
  return Object.freeze(leaves);
}

export function parseCakeProductPage(response: JsonObject, path: CakeCategoryPath): CakeProductPage {
  const data = object(response.data, 'CAKE_PRODUCTS_DATA_INVALID');
  const total = cakeuncleNonnegativeInteger(numericText(data.total_num, 'CAKE_PRODUCTS_TOTAL_INVALID'), 'CAKE_PRODUCTS_TOTAL_INVALID');
  const products = array(data.products, 'CAKE_PRODUCTS_INVALID');
  const specs: CakeSpecSnapshot[] = [];
  const seen = new Set<string>();
  products.forEach((value) => {
    const product = object(value, 'CAKE_PRODUCT_INVALID');
    assertCategory(product, path.request);
    const productId = identifier(product.product_id, 'CAKE_PRODUCT_ID_INVALID');
    const productName = required(product.product_name, 'CAKE_PRODUCT_NAME_INVALID');
    const productSpecs = array(product.specs, 'CAKE_PRODUCT_SPECS_INVALID');
    if (productSpecs.length === 0) throw new Error('CAKE_PRODUCT_SPECS_EMPTY');
    productSpecs.forEach((item) => {
      const spec = object(item, 'CAKE_SPEC_INVALID');
      const externalId = identifier(spec.spec_id, 'CAKE_SPEC_ID_INVALID');
      if (seen.has(externalId)) throw new Error('CAKE_SPEC_DUPLICATE');
      seen.add(externalId);
      specs.push(mapSpec(product, spec, productId, productName, externalId));
    });
  });
  return Object.freeze({ total, productCount: products.length, specs: Object.freeze(specs) });
}

export function catalogBatch(page: CakeProductPage, complete: boolean, nextCursor?: string): CatalogBatch {
  return Object.freeze({
    records: Object.freeze(page.specs.map(({ externalId, version, payload }) => Object.freeze({ externalId, version, payload }))),
    errors: Object.freeze([]),
    complete,
    ...(nextCursor === undefined ? {} : { nextCursor }),
  });
}

export function priceBatch(keys: readonly string[], snapshots: ReadonlyMap<string, CakeSpecSnapshot>, observedAt: string): PriceBatch {
  return Object.freeze({ records: Object.freeze(keys.map((key) => {
    const snapshot = requiredSnapshot(snapshots, key);
    return Object.freeze({
      externalId: key,
      amountMinor: snapshot.amountMinor,
      ...(snapshot.compareMinor === undefined ? {} : { compareMinor: snapshot.compareMinor }),
      currency: 'CNY',
      version: snapshot.version,
      effectiveAt: observedAt,
    });
  })) });
}

export function stockBatch(keys: readonly string[], snapshots: ReadonlyMap<string, CakeSpecSnapshot>, observedAt: string): StockBatch {
  return Object.freeze({ records: Object.freeze(keys.map((key) => {
    const snapshot = snapshots.get(key);
    if (!snapshot) return Object.freeze({ externalId: key, onhand: 0, safety: 0,
      version: createHash('sha256').update(`missing:${key}`).digest('hex'), observedAt, missing: true });
    return Object.freeze({ externalId: key, onhand: snapshot.onhand, safety: 0, version: snapshot.version,
      observedAt, ...(snapshot.unlimited ? { unlimited: true } : {}) });
  })) });
}

function mapSpec(product: JsonObject, spec: JsonObject, productId: string, productName: string, externalId: string): CakeSpecSnapshot {
  const amountMinor = cakeuncleMinor(required(spec.price, 'CAKE_SPEC_PRICE_INVALID'), 'CAKE_SPEC_PRICE_INVALID');
  const marketMinor = cakeuncleMinor(required(spec.market_price, 'CAKE_SPEC_MARKET_PRICE_INVALID'), 'CAKE_SPEC_MARKET_PRICE_INVALID');
  const compareMinor = marketMinor >= amountMinor ? marketMinor : 0;
  const clearingPriceMinor = cakeuncleMinor(required(spec.clearing_price, 'CAKE_SPEC_CLEARING_PRICE_INVALID'), 'CAKE_SPEC_CLEARING_PRICE_INVALID');
  const stock = stockValue(required(spec.stock, 'CAKE_SPEC_STOCK_INVALID'));
  const categoryIds = ['cat_id', 'cat_id2', 'cat_id3'].map((key) => optional(product[key])).filter(isString);
  const payload = Object.freeze({
    schema: 'cakeuncle.physical-sku.v1',
    provider: 'cake',
    productId,
    specId: externalId,
    productName,
    specName: required(spec.spec_name, 'CAKE_SPEC_NAME_INVALID'),
    description: optional(product.product_description) ?? optional(product.introduce) ?? productName,
    ...(optional(product.brand_id) ? { brandId: optional(product.brand_id)! } : {}),
    ...(optional(product.brand_name) ? { brandName: optional(product.brand_name)! } : {}),
    categoryIds: Object.freeze(categoryIds),
    cityIds: Object.freeze(csv(optional(product.city_ids))),
    tastes: Object.freeze(csv(optional(spec.tastes))),
    labels: Object.freeze(csv(optional(product.label_name))),
    imagePaths: Object.freeze(images(product, spec)),
    ...(optional(spec.gift) ? { gift: optional(spec.gift)! } : {}),
    ...(optional(product.storage) ? { storage: optional(product.storage)! } : {}),
    ...(optional(product.expiry_days) ? { expiryDays: cakeuncleNonnegativeInteger(optional(product.expiry_days)!, 'CAKE_PRODUCT_EXPIRY_INVALID') } : {}),
    supportsGreeting: greeting(product.is_greeting),
    currency: 'CNY',
    amountMinor,
    ...(compareMinor === 0 ? {} : { compareMinor }),
    onhand: stock.onhand,
    unlimited: stock.unlimited,
    charges: Object.freeze(charges(product.charges)),
  }) satisfies JsonObject;
  const version = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return Object.freeze({ externalId, version, payload, amountMinor,
    ...(compareMinor === 0 ? {} : { compareMinor }), clearingPriceMinor,
    onhand: stock.onhand, unlimited: stock.unlimited });
}

function categoryRequest(chain: readonly CakeCategory[]): JsonObject {
  return Object.freeze(Object.fromEntries(chain.map((category) => [category.level === 1 ? 'cat_id' : `cat_id${category.level}`, category.id])) as JsonObject);
}

function assertCategory(product: JsonObject, request: JsonObject): void {
  for (const key of ['cat_id', 'cat_id2', 'cat_id3']) {
    if (request[key] !== undefined && required(product[key], 'CAKE_PRODUCT_CATEGORY_INVALID') !== request[key]) {
      throw new Error('CAKE_PRODUCT_CATEGORY_MISMATCH');
    }
  }
}

function charges(value: JsonValue | undefined): readonly JsonObject[] {
  if (value === undefined || value === null) return [];
  return array(value, 'CAKE_PRODUCT_CHARGES_INVALID').map((item) => {
    const source = object(item, 'CAKE_PRODUCT_CHARGE_INVALID');
    return Object.freeze({
      id: identifier(source.id, 'CAKE_PRODUCT_CHARGE_ID_INVALID'),
      name: required(source.name, 'CAKE_PRODUCT_CHARGE_NAME_INVALID'),
      amountMinor: cakeuncleMinor(required(source.price, 'CAKE_PRODUCT_CHARGE_PRICE_INVALID'), 'CAKE_PRODUCT_CHARGE_PRICE_INVALID'),
      type: required(source.type, 'CAKE_PRODUCT_CHARGE_TYPE_INVALID'),
    });
  }).sort((left, right) => compareText(String(left.id), String(right.id)));
}

function images(product: JsonObject, spec: JsonObject): readonly string[] {
  const paths = [optional(product.image_path), optional(spec.spec_img)];
  for (const key of ['carousel_image', 'detail_image']) {
    const value = product[key];
    if (value === undefined || value === null) continue;
    const source = object(value, 'CAKE_PRODUCT_IMAGE_INVALID');
    paths.push(optional(source.m_path), optional(source.l_path), optional(source.s_path));
  }
  return sortedUnique(paths.filter(isString).flatMap(csv));
}

function greeting(value: JsonValue | undefined): boolean {
  const raw = required(value, 'CAKE_PRODUCT_GREETING_INVALID');
  if (raw === '0') return true;
  if (raw === '1') return false;
  throw new Error('CAKE_PRODUCT_GREETING_INVALID');
}

function stockValue(value: string): Readonly<{ onhand: number; unlimited: boolean }> {
  if (value === '-9999999') return Object.freeze({ onhand: CAKEUNCLE_UNLIMITED_ONHAND, unlimited: true });
  const onhand = cakeuncleNonnegativeInteger(value, 'CAKE_SPEC_STOCK_INVALID');
  return Object.freeze({ onhand, unlimited: false });
}

function requiredSnapshot(snapshots: ReadonlyMap<string, CakeSpecSnapshot>, key: string): CakeSpecSnapshot {
  const value = snapshots.get(key);
  if (!value) throw new Error(`CAKE_SPEC_NOT_FOUND:${key}`);
  return value;
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

function numericText(value: JsonValue | undefined, code: string): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return required(value, code);
}

function optional(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function identifier(value: JsonValue | undefined, code: string): string {
  const id = required(value, code);
  if (!/^\d+$/.test(id)) throw new Error(code);
  return id;
}

function csv(value: string | undefined): readonly string[] {
  if (!value) return [];
  return sortedUnique(value.split(',').map((item) => item.trim()).filter(Boolean));
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareText);
}

function compareCategory(left: CakeCategory, right: CakeCategory): number { return compareText(left.id, right.id); }
function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function isString(value: string | undefined): value is string { return value !== undefined; }
