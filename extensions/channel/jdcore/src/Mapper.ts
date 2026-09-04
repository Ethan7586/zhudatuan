import type { JsonObject, JsonValue } from '@shop/contract';

export function jdString(source: JsonObject, key: string, code: string): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

export function jdMoneyMinor(value: JsonValue | undefined, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}

export function jdAddress(value: JsonValue | undefined): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JD_ADDRESS_INVALID');
  const source = value as JsonObject;
  return Object.freeze({ province: jdString(source, 'province', 'JD_PROVINCE_INVALID'), city: jdString(source, 'city', 'JD_CITY_INVALID'), district: jdString(source, 'district', 'JD_DISTRICT_INVALID'), detail: jdString(source, 'detail', 'JD_ADDRESS_DETAIL_INVALID') });
}
