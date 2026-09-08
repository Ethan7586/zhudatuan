import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { textField } from '../../../../pipeline/Validation';
import type { ConnectionConfiguration } from '../port/ConnectionRepository';

const MAX_CONFIGURATION_BYTES = 32_768;
const MAX_CONFIGURATION_DEPTH = 8;
const MAX_CONFIGURATION_ITEMS = 256;
const MAX_ENDPOINTS = 64;
const MAX_PUBLIC_TEXT = 4_096;
const OPERATION = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/;
const REGION = /^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/;
const SECRET_REFERENCE = /^[a-z0-9][a-z0-9/.-]{2,255}$/;
const FORBIDDEN_KEY = /(?:secret|password|credential|token|privatekey|apikey|authorization)/i;
const FORBIDDEN_OBJECT_KEY = /^(?:__proto__|constructor|prototype)$/;

export function connectionConfiguration(body: Readonly<Record<string, unknown>>): ConnectionConfiguration {
  const source = publicDocument(record(body.configuration));
  const region = required(source.region, 'PROVIDER_REGION_INVALID', 64);
  if (!REGION.test(region)) throw new Error('PROVIDER_REGION_INVALID');
  const baseUrl = providerUrl(source.baseUrl);
  const endpoints = stringMap(source.endpoints);
  const healthOperation = operation(source.healthOperation, 'PROVIDER_HEALTH_OPERATION_INVALID');
  const document = freeze({ ...source, region, baseUrl, endpoints, healthOperation });
  if (Buffer.byteLength(JSON.stringify(document), 'utf8') > MAX_CONFIGURATION_BYTES) throw new Error('PROVIDER_CONFIGURATION_TOO_LARGE');
  return Object.freeze({
    region,
    baseUrl,
    endpoints,
    healthOperation,
    document,
  });
}

export function connectionProvider(body: Readonly<Record<string, unknown>>): string {
  const provider = textField(body, 'provider', 64);
  if (!REQUIRED_PROVIDER_IDS.includes(provider)) throw new Error('PROVIDER_NOT_MVP_LOADABLE');
  return provider;
}

export function secretReference(body: Readonly<Record<string, unknown>>, preserveMissing: boolean): string | null | undefined {
  const value = body.secretRef;
  if (value === undefined || value === '') return preserveMissing ? undefined : null;
  if (value === null) return null;
  const reference = required(value, 'PROVIDER_SECRET_REFERENCE_INVALID', 256);
  if (!SECRET_REFERENCE.test(reference)) throw new Error('PROVIDER_SECRET_REFERENCE_INVALID');
  return reference;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}

function stringMap(value: unknown): Readonly<Record<string, string>> {
  const source = value === undefined ? {} : record(value);
  const entries = Object.entries(source);
  if (entries.length > MAX_ENDPOINTS) throw new Error('PROVIDER_ENDPOINTS_INVALID');
  const normalized: Record<string, string> = {};
  for (const [key, value] of entries) {
    const name = operation(key, 'PROVIDER_ENDPOINTS_INVALID');
    if (typeof value !== 'string') throw new Error('PROVIDER_ENDPOINTS_INVALID');
    const endpoint = value.trim();
    if (!endpoint || endpoint.length > 2_048 || !endpoint.startsWith('/') || endpoint.startsWith('//') || endpoint.includes('?') || endpoint.includes('#')) {
      throw new Error('PROVIDER_ENDPOINTS_INVALID');
    }
    if (normalized[name] !== undefined) throw new Error('PROVIDER_ENDPOINTS_INVALID');
    normalized[name] = endpoint;
  }
  return Object.freeze(normalized);
}

function required(value: unknown, code: string, maximum = MAX_PUBLIC_TEXT): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) throw new Error(code);
  return value.trim();
}

function operation(value: unknown, code: string): string {
  const item = required(value, code, 64);
  if (!OPERATION.test(item)) throw new Error(code);
  return item;
}

function providerUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const item = required(value, 'PROVIDER_BASE_URL_INVALID', 2_048);
  let url: URL;
  try {
    url = new URL(item);
  } catch {
    throw new Error('PROVIDER_BASE_URL_INVALID');
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) throw new Error('PROVIDER_BASE_URL_INVALID');
  return item;
}

function publicDocument(source: Record<string, unknown>): Readonly<Record<string, unknown>> {
  const state = { items: 0 };
  return freezeValue(source, 0, state) as Readonly<Record<string, unknown>>;
}

function freezeValue(value: unknown, depth: number, state: { items: number }): unknown {
  if (depth > MAX_CONFIGURATION_DEPTH || ++state.items > MAX_CONFIGURATION_ITEMS) throw new Error('PROVIDER_CONFIGURATION_TOO_COMPLEX');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PROVIDER_CONFIGURATION_INVALID');
    return value;
  }
  if (typeof value === 'string') {
    if (value.length > MAX_PUBLIC_TEXT) throw new Error('PROVIDER_CONFIGURATION_INVALID');
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item) => freezeValue(item, depth + 1, state)));
  if (!value || typeof value !== 'object') throw new Error('PROVIDER_CONFIGURATION_INVALID');
  const entries = Object.entries(value as Record<string, unknown>);
  const document: Record<string, unknown> = {};
  for (const [key, item] of entries) {
    if (!key || key.length > 64 || FORBIDDEN_KEY.test(key) || FORBIDDEN_OBJECT_KEY.test(key)) throw new Error('PROVIDER_CONFIGURATION_SECRET_FORBIDDEN');
    document[key] = freezeValue(item, depth + 1, state);
  }
  return Object.freeze(document);
}

function freeze(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return freezeValue(value, 0, { items: 0 }) as Readonly<Record<string, unknown>>;
}
