import type { JsonObject, JsonValue } from '@shop/contract';
import { CanonicalSourceMapper } from '@shop/providercore';
import { MEAL_BRANDS } from '../BrandCatalog';

export class MealMapper extends CanonicalSourceMapper {
  override objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return super.objects(value.map((record) => canonical(record)), code);
  }
}

function canonical(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('MEAL_RECORD_INVALID');
  const source = value as JsonObject;
  if (source.externalId !== undefined) return source;
  const brand = source.brand;
  if (typeof brand !== 'string' || !(MEAL_BRANDS as readonly string[]).includes(brand)) throw new Error('MEAL_BRAND_INVALID');
  return Object.freeze({ externalId: text(source.setId, 'MEAL_SET_INVALID'), version: text(source.updatedAt, 'MEAL_VERSION_INVALID'), payload: Object.freeze({ brand, storeId: text(source.storeId, 'MEAL_STORE_INVALID'), components: objects(source.components, 'MEAL_COMPONENTS_INVALID'), appointmentSlots: strings(source.appointmentSlots, 'MEAL_SLOTS_INVALID'), credentialState: text(source.credentialState, 'MEAL_CREDENTIAL_STATE_INVALID') }) });
}

function text(value: JsonValue | undefined, code: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value.trim(); }
function strings(value: JsonValue | undefined, code: string): readonly string[] { if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || !item.trim())) throw new Error(code); return Object.freeze(value.map(String)); }
function objects(value: JsonValue | undefined, code: string): readonly JsonObject[] { if (!Array.isArray(value) || !value.length || value.some((item) => item === null || typeof item !== 'object' || Array.isArray(item))) throw new Error(code); return value as readonly JsonObject[]; }
