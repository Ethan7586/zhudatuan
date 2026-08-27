import { CACHE_CATALOG } from '@shop/config/runtime';

export type CacheName = keyof typeof CACHE_CATALOG;

export class VersionedKey {
  static create(name: CacheName, values: Readonly<Record<string, string | number>>): string {
    const fields = CACHE_CATALOG[name].key.split(':');
    if (Object.keys(values).sort().join(',') !== [...fields].sort().join(',')) throw new Error(`CACHE_KEY_FIELDS_INVALID:${name}`);
    return ['shop', 'v1', name, ...fields.map((field) => encode(values[field]!))].join(':');
  }
}

function encode(value: string | number): string {
  const text = String(value);
  if (text.length === 0 || text.length > 512) throw new Error('CACHE_KEY_VALUE_INVALID');
  return Buffer.from(text).toString('base64url');
}
