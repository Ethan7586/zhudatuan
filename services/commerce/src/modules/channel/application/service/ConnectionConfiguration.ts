import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { textField } from '../../../../foundation/interface/Validation';
import type { ConnectionConfiguration } from '../port/ConnectionRepository';

export function connectionConfiguration(body: Readonly<Record<string, unknown>>): ConnectionConfiguration {
  const document = record(body.configuration);
  return Object.freeze({
    region: required(document.region, 'PROVIDER_REGION_INVALID'),
    baseUrl: optional(document.baseUrl),
    endpoints: stringMap(document.endpoints),
    healthOperation: required(document.healthOperation, 'PROVIDER_HEALTH_OPERATION_INVALID'),
    document: Object.freeze({ ...document }),
  });
}

export function connectionProvider(body: Readonly<Record<string, unknown>>): string {
  const provider = textField(body, 'provider', 64);
  if (!REQUIRED_PROVIDER_IDS.includes(provider)) throw new Error('PROVIDER_NOT_MVP_LOADABLE');
  return provider;
}

export function secretReference(body: Readonly<Record<string, unknown>>): string | null {
  return optional(body.secretRef);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}

function stringMap(value: unknown): Readonly<Record<string, string>> {
  const source = value === undefined ? {} : record(value);
  if (!Object.values(source).every((item) => typeof item === 'string' && item.trim())) throw new Error('PROVIDER_ENDPOINTS_INVALID');
  return Object.freeze(source as Record<string, string>);
}

function required(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function optional(value: unknown): string | null {
  return value === undefined || value === null || value === '' ? null : required(value, 'VALIDATION_FAILED');
}
