import type { JsonObject, JsonValue } from '@shop/contract';
import { CanonicalSourceMapper } from '@shop/providercore';

export class CakeMapper extends CanonicalSourceMapper {
  override objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return super.objects(value.map((record) => canonical(record)), code);
  }
}

function canonical(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('CAKE_RECORD_INVALID');
  const source = value as JsonObject;
  if (source.externalId !== undefined) return source;
  const blessingMaxLength = positiveInteger(source.blessingMaxLength, 'CAKE_BLESSING_LIMIT_INVALID');
  return Object.freeze({
    externalId: text(source.productId, 'CAKE_PRODUCT_INVALID'),
    version: text(source.updatedAt, 'CAKE_VERSION_INVALID'),
    payload: Object.freeze({ options: objects(source.options, 'CAKE_OPTIONS_INVALID'), stores: strings(source.stores, 'CAKE_STORES_INVALID'), deliveryRegions: strings(source.deliveryRegions, 'CAKE_REGIONS_INVALID'), appointmentDates: dates(source.appointmentDates), blessingMaxLength }),
  });
}

function text(value: JsonValue | undefined, code: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value.trim(); }
function strings(value: JsonValue | undefined, code: string): readonly string[] { if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || !item.trim())) throw new Error(code); return Object.freeze(value.map(String)); }
function objects(value: JsonValue | undefined, code: string): readonly JsonObject[] { if (!Array.isArray(value) || !value.length || value.some((item) => item === null || typeof item !== 'object' || Array.isArray(item))) throw new Error(code); return value as readonly JsonObject[]; }
function dates(value: JsonValue | undefined): readonly string[] { const values = strings(value, 'CAKE_APPOINTMENT_DATE_INVALID'); if (values.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item))) throw new Error('CAKE_APPOINTMENT_DATE_INVALID'); return values; }
function positiveInteger(value: JsonValue | undefined, code: string): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(code); return value; }
