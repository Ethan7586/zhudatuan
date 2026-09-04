import type { JsonObject, JsonValue } from '@shop/contract';
import { jdAddress, jdMoneyMinor, jdString } from '@shop/providerjdcore';
import { CanonicalSourceMapper } from '@shop/providercore';

export class JdproductMapper extends CanonicalSourceMapper {
  override objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return super.objects(value.map((record) => canonical(record)), code);
  }
}

function canonical(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JDPRODUCT_RECORD_INVALID');
  const source = value as JsonObject;
  if (source.externalId !== undefined) return source;
  const address = source.address === undefined ? undefined : jdAddress(source.address);
  return Object.freeze({
    externalId: jdString(source, 'skuId', 'JDPRODUCT_SKU_INVALID'),
    version: jdString(source, 'updatedAt', 'JDPRODUCT_VERSION_INVALID'),
    payload: Object.freeze({
      title: jdString(source, 'title', 'JDPRODUCT_TITLE_INVALID'),
      categoryId: jdString(source, 'categoryId', 'JDPRODUCT_CATEGORY_INVALID'),
      priceMinor: jdMoneyMinor(source.priceFen, 'JDPRODUCT_PRICE_INVALID'),
      stock: jdMoneyMinor(source.stock, 'JDPRODUCT_STOCK_INVALID'),
      ...(address === undefined ? {} : { address }),
    }),
  });
}
