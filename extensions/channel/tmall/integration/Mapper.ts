import type { JsonObject, JsonValue } from '@shop/contract';
import { CanonicalSourceMapper } from '@shop/providercore';

export class TmallMapper extends CanonicalSourceMapper {
  override objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return super.objects(value.map((record) => canonical(record)), code);
  }
}

function canonical(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('TMALL_RECORD_INVALID');
  const source = value as JsonObject;
  if (source.externalId !== undefined) return source;
  const itemId = text(source.itemId, 'TMALL_ITEM_INVALID');
  const modifiedAt = text(source.modifiedAt, 'TMALL_VERSION_INVALID');
  const priceMinor = integer(source.priceCent, 'TMALL_PRICE_INVALID');
  const stock = integer(source.stock, 'TMALL_STOCK_INVALID');
  return Object.freeze({ externalId: itemId, version: modifiedAt, payload: Object.freeze({ title: text(source.title, 'TMALL_TITLE_INVALID'), priceMinor, stock }) });
}

function text(value: JsonValue | undefined, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function integer(value: JsonValue | undefined, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}
