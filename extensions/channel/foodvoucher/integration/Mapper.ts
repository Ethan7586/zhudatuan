import type { JsonObject, JsonValue } from '@shop/contract';
import { CanonicalSourceMapper } from '@shop/providercore';

const STATES = new Set(['issued', 'bound', 'redeemed', 'voided', 'refunded']);

export class FoodvoucherMapper extends CanonicalSourceMapper {
  override objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return super.objects(value.map((record) => canonical(record)), code);
  }
}

function canonical(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('FOODVOUCHER_RECORD_INVALID');
  const source = value as JsonObject;
  if (source.externalId !== undefined) return source;
  const state = source.codeState;
  if (typeof state !== 'string' || !STATES.has(state)) throw new Error('FOODVOUCHER_STATE_INVALID');
  return Object.freeze({ externalId: text(source.voucherProductId, 'FOODVOUCHER_PRODUCT_INVALID'), version: text(source.updatedAt, 'FOODVOUCHER_VERSION_INVALID'), payload: Object.freeze({ stores: strings(source.storeIds, 'FOODVOUCHER_STORES_INVALID'), codeReference: text(source.codeReference, 'FOODVOUCHER_CODE_REFERENCE_INVALID'), codeState: state }) });
}

function text(value: JsonValue | undefined, code: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value.trim(); }
function strings(value: JsonValue | undefined, code: string): readonly string[] { if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || !item.trim())) throw new Error(code); return Object.freeze(value.map(String)); }
