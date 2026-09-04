import type { JsonObject, JsonValue } from '@shop/contract';
import { wanlianReference, wanlianTimestamp } from '@shop/providerwanliancore';
import { CanonicalSourceMapper } from '@shop/providercore';

export type ChargeKind = 'phone' | 'fuel';

export class ChargeMapper extends CanonicalSourceMapper {
  override objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return super.objects(value.map((record) => canonical(record)), code);
  }
}

export function validateChargeNumber(kind: ChargeKind, target: string): string {
  const value = target.trim();
  const valid = kind === 'phone' ? /^1[3-9]\d{9}$/.test(value) : /^\d{8,20}$/.test(value);
  if (!valid) throw new Error(kind === 'phone' ? 'CHARGE_PHONE_INVALID' : 'CHARGE_FUEL_CARD_INVALID');
  return value;
}

export function normalizeChargeResult(status: string): Readonly<{ state: 'succeeded' | 'failed' | 'processing' | 'unknown'; recoverByQuery: boolean }> {
  if (status === 'SUCCESS') return Object.freeze({ state: 'succeeded', recoverByQuery: false });
  if (status === 'FAILED') return Object.freeze({ state: 'failed', recoverByQuery: false });
  if (status === 'PROCESSING') return Object.freeze({ state: 'processing', recoverByQuery: true });
  return Object.freeze({ state: 'unknown', recoverByQuery: true });
}

function canonical(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('CHARGE_RECORD_INVALID');
  const source = value as JsonObject;
  if (source.externalId !== undefined) return source;
  const kind = source.kind;
  if (kind !== 'phone' && kind !== 'fuel') throw new Error('CHARGE_KIND_INVALID');
  return Object.freeze({ externalId: wanlianReference(source), version: wanlianTimestamp(source), payload: Object.freeze({ kind, denominationMinor: positiveInteger(source.denominationCent, 'CHARGE_DENOMINATION_INVALID'), targetExample: validateChargeNumber(kind, text(source.targetExample, 'CHARGE_TARGET_INVALID')) }) });
}

function text(value: JsonValue | undefined, code: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value.trim(); }
function positiveInteger(value: JsonValue | undefined, code: string): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(code); return value; }
