import { createHash } from 'node:crypto';
import type { JsonObject, JsonValue, ProviderRecordError } from '@shop/contract';
import type { MealBrand } from './BrandCatalog';

export interface MealMappedCatalog {
  readonly records: readonly JsonObject[];
  readonly errors: readonly ProviderRecordError[];
}

interface ProductShape {
  readonly id: string;
  readonly name: string;
  readonly amountMinor: number;
  readonly compareMinor?: number;
  readonly image?: string;
  readonly options: JsonObject;
}

export class MealMapper {
  catalog(brand: MealBrand, storeCode: string, data: JsonValue): MealMappedCatalog {
    const sources = products(brand, object(data, 'MEAL_MENU_DATA_INVALID'));
    const records: JsonObject[] = [];
    const errors: ProviderRecordError[] = [];
    const seen = new Set<string>();
    sources.forEach((source, index) => {
      try {
        const product = mapProduct(brand, source);
        if (seen.has(product.id)) throw new Error('MEAL_PRODUCT_DUPLICATE');
        seen.add(product.id);
        const payload = Object.freeze({ schema: 'cakeuncle.meal-product.v1', brand, storeCode, productId: product.id,
          name: product.name, amountMinor: product.amountMinor, currency: 'CNY',
          ...(product.compareMinor === undefined ? {} : { compareMinor: product.compareMinor }),
          ...(product.image?.startsWith('https://') ? { imageUrl: product.image } : {}), options: product.options });
        records.push(Object.freeze({ externalId: mealExternalId(brand, storeCode, product.id), version: version(payload), payload }));
      } catch (cause) {
        errors.push(Object.freeze({ key: `${brand}:${index}`, code: 'MEAL_CATALOG_RECORD_INVALID',
          message: cause instanceof Error ? cause.message : 'MEAL_CATALOG_RECORD_INVALID' }));
      }
    });
    return Object.freeze({ records: Object.freeze(records), errors: Object.freeze(errors) });
  }

  prices(brand: MealBrand, storeCode: string, data: JsonValue, observedAt: string): readonly JsonObject[] {
    return this.catalog(brand, storeCode, data).records.map((record) => {
      const payload = object(record.payload, 'MEAL_PRODUCT_PAYLOAD_INVALID');
      const amountMinor = integer(payload.amountMinor, 'MEAL_PRODUCT_PRICE_INVALID');
      const compareMinor = payload.compareMinor === undefined ? undefined : integer(payload.compareMinor, 'MEAL_PRODUCT_PRICE_INVALID');
      return Object.freeze({ externalId: text(record.externalId, 'MEAL_EXTERNAL_ID_INVALID'), amountMinor, currency: 'CNY',
        version: text(record.version, 'MEAL_PRODUCT_VERSION_INVALID'), effectiveAt: observedAt,
        ...(compareMinor === undefined ? {} : { compareMinor }) });
    });
  }
}

export function mealExternalId(brand: MealBrand, storeCode: string, productId: string): string {
  return `${brand}:${encodeURIComponent(storeCode)}:${encodeURIComponent(productId)}`;
}

export function parseMealExternalId(value: string): { readonly brand: MealBrand; readonly storeCode: string; readonly productId: string } {
  const match = /^(sbk|kfc|mcd|lk|cot|pzh|molly):([^:]+):([^:]+)$/.exec(value);
  if (!match) throw new Error('MEAL_EXTERNAL_ID_INVALID');
  try {
    const storeCode = decodeURIComponent(match[2]!);
    const productId = decodeURIComponent(match[3]!);
    if (!storeCode || !productId) throw new Error('MEAL_EXTERNAL_ID_INVALID');
    return Object.freeze({ brand: match[1] as MealBrand, storeCode, productId });
  } catch { throw new Error('MEAL_EXTERNAL_ID_INVALID'); }
}

function products(brand: MealBrand, data: JsonObject): readonly JsonObject[] {
  switch (brand) {
    case 'sbk': return array(data.categories, 'MEAL_SBK_CATEGORIES_INVALID').flatMap((category) => {
      const value = object(category, 'MEAL_SBK_CATEGORY_INVALID');
      const direct = optionalObjects(value.products, 'MEAL_SBK_PRODUCTS_INVALID');
      const nested = array(value.sub_categories, 'MEAL_SBK_SUBCATEGORIES_INVALID').flatMap((item) =>
        optionalObjects(object(item, 'MEAL_SBK_SUBCATEGORY_INVALID').products, 'MEAL_SBK_PRODUCTS_INVALID'));
      return [...direct, ...nested];
    });
    case 'kfc': return menuProducts(data, 'menu_list', 'MEAL_KFC_MENU_INVALID');
    case 'mcd': return menuProducts(data, 'product_list', 'MEAL_MCD_MENU_INVALID');
    case 'lk': return menuProducts(data, 'items', 'MEAL_LK_MENU_INVALID');
    case 'cot': return menuProducts(data, 'items', 'MEAL_COT_MENU_INVALID');
    case 'pzh': return array(data.product_p_z_h_s, 'MEAL_PZH_MENU_INVALID').flatMap((category) =>
      optionalObjects(object(category, 'MEAL_PZH_CATEGORY_INVALID').sku_attribute_p_z_h_list, 'MEAL_PZH_PRODUCTS_INVALID'));
    case 'molly': return menuProducts(data, 'item_list', 'MEAL_MOLLY_MENU_INVALID');
  }
}

function menuProducts(data: JsonObject, field: string, code: string): readonly JsonObject[] {
  return array(data.menu, code).flatMap((category) => optionalObjects(object(category, code)[field], code));
}

function mapProduct(brand: MealBrand, value: JsonObject): ProductShape {
  switch (brand) {
    case 'sbk': return shape(value, 'id', 'name', 'sale_price', 'price', 'default_image',
      compact({ defaultSkuId: value.default_sku_id }));
    case 'kfc': return shape(value, 'link_id', 'name_cn', 'amount', value.price_initial === undefined ? 'price' : 'price_initial',
      'image', compact({ menuFlag: value.menu_flag }));
    case 'mcd': return shape(value, 'product_code', 'product_name', 'amount', 'price', 'product_image',
      compact({ productType: value.product_type, choices: value.is_choices, saleStatus: value.sale_status }));
    case 'lk': return shape(value, 'product_id', 'name', 'put_amount', 'initial_price', 'default_pic_url',
      compact({ skuCode: value.sku_code }));
    case 'cot': {
      const firstSku = object(value.first_sku, 'MEAL_COT_FIRST_SKU_INVALID');
      const compare = firstSku.standard_price ?? firstSku.sell_price;
      const augmented = Object.freeze({ ...value, _amount: required(firstSku.amount, 'MEAL_COT_PRICE_INVALID'),
        ...(compare === undefined ? {} : { _compare: compare }) });
      return shape(augmented, 'item_no', 'title', '_amount', '_compare', 'img_url',
      compact({ defaultSku: firstSku.sku_no ?? firstSku.sku_code }));
    }
    case 'pzh': return shape(value, 'link_id', 'name_cn', 'amount', 'price', 'image_url', compact({ menuFlag: value.menu_flag }));
    case 'molly': return shape(value, 'id', 'name', 'put_amount', 'show_price_low', 'cover_url',
      compact({ multiSpec: value.is_multi_spec, practice: value.is_practice }));
  }
}

function shape(value: JsonObject, idField: string, nameField: string, amountField: string, compareField: string,
  imageField: string, options: JsonObject): ProductShape {
  const amountMinor = money(value[amountField], 'MEAL_PRODUCT_PRICE_INVALID');
  const compareMinor = value[compareField] === undefined || value[compareField] === null ? undefined
    : money(value[compareField], 'MEAL_PRODUCT_COMPARE_PRICE_INVALID');
  if (compareMinor !== undefined && compareMinor < amountMinor) throw new Error('MEAL_PRODUCT_COMPARE_PRICE_INVALID');
  const image = value[imageField] === undefined || value[imageField] === null ? undefined : text(value[imageField], 'MEAL_PRODUCT_IMAGE_INVALID');
  return Object.freeze({ id: text(value[idField], 'MEAL_PRODUCT_ID_INVALID'), name: text(value[nameField], 'MEAL_PRODUCT_NAME_INVALID'),
    amountMinor, ...(compareMinor === undefined ? {} : { compareMinor }), ...(image === undefined ? {} : { image }), options });
}

function compact(value: Readonly<Record<string, JsonValue | undefined>>): JsonObject {
  return Object.freeze(Object.fromEntries(Object.entries(value).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)) as JsonObject);
}

function optionalObjects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
  if (value === undefined) return [];
  return array(value, code).map((item) => object(item, code));
}

function required(value: JsonValue | undefined, code: string): JsonValue {
  if (value === undefined) throw new Error(code);
  return value;
}

function array(value: JsonValue | undefined, code: string): readonly JsonValue[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function object(value: JsonValue | undefined, code: string): JsonObject {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonObject;
}

function text(value: JsonValue | undefined, code: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(code);
  const result = String(value).trim();
  if (!result) throw new Error(code);
  return result;
}

function integer(value: JsonValue | undefined, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}

function money(value: JsonValue | undefined, code: string): number {
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error(code);
  const source = String(value).trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(source);
  if (!match) throw new Error(code);
  const amount = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) throw new Error(code);
  return amount;
}

function version(value: JsonObject): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function stable(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}
