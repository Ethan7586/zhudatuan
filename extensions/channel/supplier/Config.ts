import { strictConfigObject } from '@shop/config/provider';
import type { LocalProviderInstallation } from '@shop/providercore';
import { definition } from './Manifest';

const OPERATIONS = Object.freeze(['catalog', 'stock', 'quote', 'order', 'tracking', 'statement'] as const);
type SupplierOperation = (typeof OPERATIONS)[number];

export interface SupplierProtocolConfig {
  readonly endpoints: Readonly<Record<SupplierOperation, string>>;
  readonly fields: Readonly<Record<string, string>>;
}

export const SupplierConfig = Object.freeze({
  schema: definition.configSchema,
  secretRefs: definition.secretRefs,
  validate(local: LocalProviderInstallation) {
    if (!Object.keys(local.ports).length) throw new Error('SUPPLIER_PROVIDER_PORTS_MISSING');
    return local;
  },
  protocol(value: unknown): SupplierProtocolConfig {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('SUPPLIER_PROTOCOL_CONFIG_INVALID');
    const source = strictConfigObject(value, ['endpoints', 'fields'], 'SUPPLIER_PROTOCOL_CONFIG');
    const endpoints = record(source.endpoints, 'SUPPLIER_ENDPOINTS_INVALID');
    if (Object.keys(endpoints).some((key) => !(OPERATIONS as readonly string[]).includes(key)) || OPERATIONS.some((operation) => typeof endpoints[operation] !== 'string' || !/^\/[a-z0-9/{}]+$/i.test(endpoints[operation]!))) throw new Error('SUPPLIER_ENDPOINT_INVALID');
    const fields = record(source.fields, 'SUPPLIER_FIELDS_INVALID');
    if (!Object.keys(fields).length || Object.values(fields).some((field) => typeof field !== 'string' || !/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/.test(field))) throw new Error('SUPPLIER_FIELD_TEMPLATE_INVALID');
    return Object.freeze({ endpoints: Object.freeze(endpoints as Record<SupplierOperation, string>), fields: Object.freeze(fields as Record<string, string>) });
  },
});

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}
