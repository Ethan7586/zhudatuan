<<<<<<< HEAD
import { createHash } from 'node:crypto';

import type { JsonObject, JsonValue } from '@shop/contract';

export interface FoodvoucherProduct {
  readonly externalId: string;
  readonly version: string;
  readonly payload: JsonObject;
  readonly amountMinor: number;
  readonly compareMinor: number;
}

export class FoodvoucherMapper {
  products(response: JsonObject): readonly FoodvoucherProduct[] {
    if (response.code !== '200') throw new Error('FOODVOUCHER_RESPONSE_CODE_INVALID');
    requiredText(response.msg, 'FOODVOUCHER_RESPONSE_MESSAGE_INVALID');
    if (!Array.isArray(response.data)) throw new Error('FOODVOUCHER_PRODUCTS_INVALID');

    const products = response.data.map((value) => this.product(value));
    const ids = new Set(products.map(({ externalId }) => externalId));
    if (ids.size !== products.length) throw new Error('FOODVOUCHER_PRODUCT_DUPLICATE');
    return Object.freeze(products);
  }

  private product(value: JsonValue): FoodvoucherProduct {
    const source = object(value, 'FOODVOUCHER_PRODUCT_INVALID');
    const serviceType = integer(source.servicetype, 'FOODVOUCHER_SERVICE_TYPE_INVALID');
    if (serviceType !== 0 && serviceType !== 1) throw new Error('FOODVOUCHER_SERVICE_TYPE_INVALID');
    const type = integer(source.type, 'FOODVOUCHER_PRODUCT_ID_INVALID');
    if (type < 1) throw new Error('FOODVOUCHER_PRODUCT_ID_INVALID');

    const payload = Object.freeze({
      servicetype: serviceType,
      type,
      name: requiredText(source.name, 'FOODVOUCHER_PRODUCT_NAME_INVALID'),
      price: moneyText(source.price, 'FOODVOUCHER_PRICE_INVALID'),
      retailprice: moneyText(source.retailprice, 'FOODVOUCHER_RETAIL_PRICE_INVALID'),
      image: text(source.image, 'FOODVOUCHER_IMAGE_INVALID'),
      details_path: text(source.details_path, 'FOODVOUCHER_DETAILS_PATH_INVALID'),
      instructions: text(source.instructions, 'FOODVOUCHER_INSTRUCTIONS_INVALID'),
      brand_logo: text(source.brand_logo, 'FOODVOUCHER_BRAND_LOGO_INVALID'),
      citys: text(source.citys, 'FOODVOUCHER_CITIES_INVALID'),
      ...(source.brand === undefined ? {} : { brand: text(source.brand, 'FOODVOUCHER_BRAND_INVALID') }),
    }) satisfies JsonObject;

    const amountMinor = minor(payload.price);
    const compareMinor = minor(payload.retailprice);
    if (compareMinor < amountMinor) throw new Error('FOODVOUCHER_RETAIL_PRICE_INVALID');
    return Object.freeze({
      externalId: String(type),
      version: createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex'),
      payload,
      amountMinor,
      compareMinor,
    });
  }
}

function object(value: JsonValue, code: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonObject;
}

function integer(value: JsonValue | undefined, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(code);
  return value;
}

function text(value: JsonValue | undefined, code: string): string {
  if (typeof value !== 'string') throw new Error(code);
  return value;
}

function requiredText(value: JsonValue | undefined, code: string): string {
  const result = text(value, code).trim();
  if (!result) throw new Error(code);
  return result;
}

function moneyText(value: JsonValue | undefined, code: string): string {
  const result = text(value, code);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(result)) throw new Error(code);
  return result;
}

function minor(value: string): number {
  const [yuan, fraction = ''] = value.split('.');
  const amount = Number(yuan) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) throw new Error('FOODVOUCHER_PRICE_RANGE_INVALID');
  return amount;
}
=======
export { CanonicalSourceMapper as FoodvoucherMapper } from '@shop/providercore';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
