import { createHash } from 'node:crypto';
import type { ProviderOperationKind, ProviderOperationResult, ProviderOperationState } from '@shop/contract';

export type { ProviderOperationKind, ProviderOperationState } from '@shop/contract';

export interface ProviderResponseSummary extends Readonly<Record<string, string | number | boolean>> {
  readonly state?: string;
  readonly externalReference?: string;
  readonly code?: string;
}

export interface ProviderOperationSnapshot {
  readonly id: string;
  readonly provider: string;
  readonly scope: string;
  readonly kind: ProviderOperationKind;
  readonly idempotency: string;
  readonly internalReference: string;
  readonly externalReference: string | null;
  readonly state: ProviderOperationState;
  readonly requestHash: string;
  readonly responseSummary: ProviderResponseSummary;
  readonly responseHash: string;
  readonly version: number;
}

export class ProviderOperation {
  constructor(readonly value: ProviderOperationSnapshot) {
    if (
      [value.id, value.provider, value.scope, value.idempotency, value.internalReference].some((item) => !item.trim()) ||
      !(['order', 'return', 'refund'] as const).includes(value.kind) ||
      !(['queued', 'submitted', 'processing', 'succeeded', 'failed', 'unknown'] as const).includes(value.state) ||
      !/^[a-f0-9]{64}$/.test(value.requestHash) ||
      !/^[a-f0-9]{64}$/.test(value.responseHash) ||
      !Number.isSafeInteger(value.version) ||
      value.version < 0 ||
      (value.externalReference !== null && !value.externalReference.trim()) ||
      digest(value.responseSummary) !== value.responseHash
    )
      throw new Error('CHANNEL_PROVIDER_OPERATION_INVALID');
    this.value = Object.freeze({ ...value, responseSummary: Object.freeze({ ...value.responseSummary }) });
    Object.freeze(this);
  }
}

export function providerResult(value: ProviderOperationResult | null): ProviderOperationResult | null {
  if (value === null) return null;
  const allowed = new Set(['accepted', 'code', 'externalReference', 'itemCount', 'state']);
  if (
    Object.keys(value).some((key) => !allowed.has(key)) ||
    !text(value.state, 64) ||
    (value.externalReference !== null && !text(value.externalReference, 255)) ||
    (value.code !== undefined && !/^[A-Z][A-Z0-9_]{2,127}$/.test(value.code)) ||
    (value.accepted !== undefined && typeof value.accepted !== 'boolean') ||
    (value.itemCount !== undefined && (!Number.isSafeInteger(value.itemCount) || value.itemCount < 0))
  ) {
    throw new Error('CHANNEL_PROVIDER_RESULT_INVALID');
  }
  return Object.freeze({
    state: value.state.trim(),
    externalReference: value.externalReference === null ? null : value.externalReference.trim(),
    ...(value.code === undefined ? {} : { code: value.code }),
    ...(value.accepted === undefined ? {} : { accepted: value.accepted }),
    ...(value.itemCount === undefined ? {} : { itemCount: value.itemCount }),
  });
}

export function providerResponse(value: unknown): Readonly<{ summary: ProviderResponseSummary; hash: string }> {
  const source = object(value);
  const summary: Record<string, string | number | boolean> = {};
  copyText(source, summary, 'state');
  copyText(source, summary, 'externalReference');
  if (summary.externalReference === undefined) copyText(source, summary, 'reference', 'externalReference');
  copyCode(source, summary, 'code');
  if (summary.code === undefined) copyCode(source, summary, 'error', 'code');
  copyScalar(source, summary, 'accepted');
  copyScalar(source, summary, 'itemCount');
  const frozen = Object.freeze(summary);
  return Object.freeze({ summary: frozen, hash: digest(frozen) });
}

export function requestSummary(hash: string): Readonly<{ hash: string }> {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('CHANNEL_PROVIDER_REQUEST_HASH_INVALID');
  return Object.freeze({ hash });
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : Object.freeze({});
}

function copyText(source: Readonly<Record<string, unknown>>, target: Record<string, string | number | boolean>, key: string, output = key): void {
  const value = source[key];
  if (typeof value === 'string' && value.trim()) target[output] = value.trim().slice(0, 255);
}

function copyCode(source: Readonly<Record<string, unknown>>, target: Record<string, string | number | boolean>, key: string, output = key): void {
  const value = source[key];
  if (typeof value === 'string' && /^[A-Z][A-Z0-9_]{2,127}$/.test(value)) target[output] = value;
}

function copyScalar(source: Readonly<Record<string, unknown>>, target: Record<string, string | number | boolean>, key: string): void {
  const value = source[key];
  if (typeof value === 'boolean' || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)) target[key] = value;
}

function text(value: string, maximum: number): boolean {
  return value.trim().length > 0 && value.trim().length <= maximum && !/[\u0000-\u001f\u007f]/.test(value);
}

function digest(value: Readonly<Record<string, unknown>>): string {
  return createHash('sha256')
    .update(['state', 'externalReference', 'code', 'accepted', 'itemCount'].map((key) => (value[key] === undefined ? '' : String(value[key]))).join('\u001f'))
    .digest('hex');
}
