import type { JsonObject, JsonValue } from '@shop/contract';
import { CanonicalSourceMapper } from '@shop/providercore';

export class FlowerMapper extends CanonicalSourceMapper {
  override objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return super.objects(value.map((record) => canonical(record)), code);
  }
}

function canonical(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('FLOWER_RECORD_INVALID');
  const source = value as JsonObject;
  if (source.externalId !== undefined) return source;
  const cardMaxLength = integer(source.cardMaxLength, 'FLOWER_CARD_LIMIT_INVALID');
  return Object.freeze({ externalId: text(source.flowerId, 'FLOWER_PRODUCT_INVALID'), version: text(source.updatedAt, 'FLOWER_VERSION_INVALID'), payload: Object.freeze({ materials: strings(source.materials, 'FLOWER_MATERIAL_INVALID'), cities: strings(source.cities, 'FLOWER_CITY_INVALID'), deliveryDates: strings(source.deliveryDates, 'FLOWER_DATE_INVALID'), cardMaxLength, deliveryState: text(source.deliveryState, 'FLOWER_DELIVERY_STATE_INVALID') }) });
}

function text(value: JsonValue | undefined, code: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value.trim(); }
function strings(value: JsonValue | undefined, code: string): readonly string[] { if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || !item.trim())) throw new Error(code); return Object.freeze(value.map(String)); }
function integer(value: JsonValue | undefined, code: string): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(code); return value; }
