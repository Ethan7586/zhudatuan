import type { ProviderCapability } from './Capability';

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

export interface ProviderDependency {
  readonly id: string;
  readonly version: string;
  readonly capabilities: readonly ProviderCapability[];
}

export interface ProviderManifest {
  readonly id: string;
  readonly name: string;
  readonly kind: ProviderKind;
  readonly version: string;
  readonly apiVersion: string;
  readonly contractVersion: string;
  readonly dependencies: readonly ProviderDependency[];
  readonly healthOperation: string;
  readonly capabilities: readonly ProviderCapability[];
  readonly permissions: readonly string[];
  readonly configSchema: string;
  readonly eventSubscriptions: readonly string[];
  readonly secretRefs: readonly string[];
  readonly sandbox: Readonly<{ supported: true; mode: 'endpoint' | 'local'; endpointRef: string | null }>;
  readonly rateLimits: Readonly<{ requestsPerSecond: number; maxConcurrency: number }>;
  readonly timeout: Readonly<{ connectionMs: number; responseMs: number; totalMs: number }>;
  readonly retryPolicy: Readonly<{ maxAttempts: number }>;
  readonly circuitPolicy: Readonly<{ failureThreshold: number; recoveryMs: number }>;
  readonly webhookContract: string | null;
  readonly signature: string;
}

export type UnsignedProviderManifest = Omit<ProviderManifest, 'signature'>;

export function manifestPayload(manifest: ProviderManifest): string {
  return JSON.stringify(
    stable({
      ...manifest,
      capabilities: [...manifest.capabilities].sort(),
      dependencies: [...manifest.dependencies]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((dependency) => ({ ...dependency, capabilities: [...dependency.capabilities].sort() })),
      eventSubscriptions: [...manifest.eventSubscriptions].sort(),
      permissions: [...manifest.permissions].sort(),
      secretRefs: [...manifest.secretRefs].sort(),
      signature: undefined,
    })
  );
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)])
    );
  return value;
}
