import type { ProviderCapability } from './Capability';

export type ProviderPriority = 1 | 3 | 4;
export type ProviderKind = 'channel';
export const PROVIDER_API_VERSION = '2026-08-21' as const;

export interface ProviderLimit {
  readonly connectionTimeoutMs: number;
  readonly responseTimeoutMs: number;
  readonly totalDeadlineMs: number;
  readonly maxConcurrency: number;
  readonly requestsPerSecond: number;
  readonly maxAttempts: number;
  readonly failureThreshold: number;
  readonly recoveryMs: number;
}

export interface ProviderManifest {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly priority: ProviderPriority;
  readonly version: string;
  readonly apiVersion: string;
  readonly contractVersion: string;
  readonly healthOperation: string;
  readonly capabilities: readonly ProviderCapability[];
  readonly permissions: readonly string[];
  readonly configSchema: string;
  readonly eventSubscriptions: readonly string[];
  readonly secretRefs: readonly string[];
  readonly limits: ProviderLimit;
  readonly signature: string;
}

export type UnsignedProviderManifest = Omit<ProviderManifest, 'signature'>;

export function manifestPayload(manifest: ProviderManifest): string {
  return JSON.stringify({
    ...manifest,
    capabilities: [...manifest.capabilities].sort(),
    eventSubscriptions: [...manifest.eventSubscriptions].sort(),
    permissions: [...manifest.permissions].sort(),
    secretRefs: [...manifest.secretRefs].sort(),
    signature: undefined,
  });
}
