import type { JsonObject, JsonValue } from '@shop/contract';
import { jdString } from '@shop/providerjdcore';
import { CanonicalSourceMapper } from '@shop/providercore';

const TEMPERATURES = new Set(['ambient', 'chilled', 'frozen']);

export class JdfreshMapper extends CanonicalSourceMapper {
  override objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return super.objects(value.map((record) => canonical(record)), code);
  }
}

function canonical(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JDFRESH_RECORD_INVALID');
  const source = value as JsonObject;
  if (source.externalId !== undefined) return source;
  const weightGram = source.weightGram;
  const temperature = source.temperatureBand;
  const deliverySlots = strings(source.deliverySlots, 'JDFRESH_DELIVERY_SLOT_INVALID');
  const regions = strings(source.regions, 'JDFRESH_REGION_INVALID');
  const substitutes = strings(source.substitutes, 'JDFRESH_SUBSTITUTE_INVALID');
  if (typeof weightGram !== 'number' || !Number.isSafeInteger(weightGram) || weightGram <= 0) throw new Error('JDFRESH_WEIGHT_INVALID');
  if (typeof temperature !== 'string' || !TEMPERATURES.has(temperature)) throw new Error('JDFRESH_TEMPERATURE_INVALID');
  return Object.freeze({
    externalId: jdString(source, 'skuId', 'JDFRESH_SKU_INVALID'),
    version: jdString(source, 'updatedAt', 'JDFRESH_VERSION_INVALID'),
    payload: Object.freeze({ weightGram, temperatureBand: temperature, deliverySlots, regions, substitutes }),
  });
}

function strings(value: JsonValue | undefined, code: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) throw new Error(code);
  return Object.freeze(value.map((entry) => String(entry).trim()));
}
