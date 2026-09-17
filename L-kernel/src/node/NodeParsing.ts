import { signedLevelNumber, type SignedLevel } from './SignedLevel';

export function parseSignedLevel(value: unknown): SignedLevel {
  const signedLevel = canonicalText(value, 'signed_level');
  signedLevelNumber(signedLevel);
  return signedLevel as SignedLevel;
}

export function parseCanonicalTimestamp(value: unknown): string {
  const timestamp = canonicalText(value, 'generated_at');
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== timestamp) {
    throw new Error('SFL_NODE_MANIFEST_TIMESTAMP_INVALID');
  }
  return timestamp;
}

export function parseNullableText(value: unknown, field: string): string | null {
  return value === null ? null : canonicalText(value, field);
}

export function canonicalText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new Error(`SFL_NODE_MANIFEST_FIELD_INVALID:${field}`);
  }
  return value;
}

export function exactRecord(value: unknown, expectedKeys: readonly string[], code: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const expected = new Set(expectedKeys);
  if (keys.length !== expected.size || keys.some((key) => !expected.has(key))) throw new Error(code);
  return record;
}
