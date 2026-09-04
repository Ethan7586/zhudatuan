import type { ChannelProvider, ProviderManifest, UnsignedProviderManifest } from '@shop/contract';
import type { ProviderPorts } from '@shop/contract';
import type { VendorConnection } from '@shop/vendorcore';

export interface ProviderInstallation {
  readonly manifest: ProviderManifest;
  readonly connection?: VendorConnection;
  readonly local?: LocalProviderInstallation;
}

export interface LocalProviderInstallation {
  readonly ports: Partial<ProviderPorts>;
  health(): Promise<boolean>;
}

export interface ProviderFactory {
  readonly id: string;
  readonly transport: 'remote' | 'local';
  readonly definition: UnsignedProviderManifest;
  create(installation: ProviderInstallation): ChannelProvider;
}

export function requireConnection(installation: ProviderInstallation): VendorConnection {
  if (!installation.connection) throw new Error(`PROVIDER_CONNECTION_MISSING:${installation.manifest.id}`);
  return installation.connection;
}

export function requireLocal(installation: ProviderInstallation): LocalProviderInstallation {
  if (!installation.local) throw new Error(`PROVIDER_LOCAL_PORTS_MISSING:${installation.manifest.id}`);
  return installation.local;
}

export function assertInstallation(factory: ProviderFactory, installation: ProviderInstallation): void {
  const actual = installation.manifest;
  const expected = factory.definition;
  const same = actual.id === expected.id &&
    actual.kind === expected.kind &&
    actual.priority === expected.priority &&
    actual.version === expected.version &&
    actual.apiVersion === expected.apiVersion &&
    actual.contractVersion === expected.contractVersion &&
    actual.healthOperation === expected.healthOperation &&
    actual.configSchema === expected.configSchema &&
    equal(actual.capabilities, expected.capabilities) &&
    equal(actual.permissions, expected.permissions) &&
    equal(actual.eventSubscriptions, expected.eventSubscriptions) &&
    equal(actual.secretRefs, expected.secretRefs) &&
    JSON.stringify(actual.limits) === JSON.stringify(expected.limits);
  if (!same) throw new Error(`PROVIDER_CONTRACT_MISMATCH:${expected.id}`);
}

function equal(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}
