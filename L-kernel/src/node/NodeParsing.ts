import { signedLevelNumber, type SignedLevel } from './SignedLevel.ts';

export type NodeProfile = 'operating_mall' | 'consumer';
export type NodeLifecycleStatus = 'provisioning' | 'active' | 'suspended' | 'retired';
export const NODE_LIFECYCLE_STATUSES = new Set<NodeLifecycleStatus>(['provisioning', 'active', 'suspended', 'retired']);

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

export function parseLifecycleStatus(value: unknown): NodeLifecycleStatus {
  const status = canonicalText(value, 'lifecycle_status');
  if (!NODE_LIFECYCLE_STATUSES.has(status as NodeLifecycleStatus)) {
    throw new Error('SFL_NODE_MANIFEST_LIFECYCLE_STATUS_INVALID');
  }
  return status as NodeLifecycleStatus;
}

export function parseNodeProfile(value: unknown): NodeProfile | null {
  if (value === null) return null;
  const profile = canonicalText(value, 'node_profile');
  if (profile !== 'operating_mall' && profile !== 'consumer') {
    throw new Error('SFL_NODE_PROFILE_INVALID');
  }
  return profile;
}

export function requiredArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`SFL_NODE_MANIFEST_ARRAY_INVALID:${field}`);
  return value;
}

export function assertRegistryIdentifierUnique(values: readonly string[], field: string): void {
  assertUniqueValues(values, (value) => `SFL_NODE_MANIFEST_REGISTRY_IDENTIFIER_AMBIGUOUS:${field}:${value}`);
}

export function assertUniqueValues(values: readonly string[], errorFor: (value: string) => string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(errorFor(value));
    seen.add(value);
  }
}

export function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
