import type { JsonObject, JsonValue } from '@shop/contract';

export function cakeEnvelope(value: JsonValue | undefined): readonly JsonObject[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('CAKE_ENVELOPE_INVALID');
  const records = (value as JsonObject).records;
  if (!Array.isArray(records) || records.some((record) => record === null || typeof record !== 'object' || Array.isArray(record))) throw new Error('CAKE_RECORDS_INVALID');
  return records as readonly JsonObject[];
}
