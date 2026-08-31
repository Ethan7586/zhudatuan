import type { ChannelProvider, ProviderManifest, UnsignedProviderManifest } from '@shop/contract';
import type { ProviderPorts } from '@shop/contract';
import type { ProviderMapper } from './Mapper';
import { createPorts, type ProviderOperations } from './PortFactory';
import { Provider } from './Provider';
import { validateConnection, type IntegrationClient, type IntegrationConnection } from './integration';

export interface ProviderInstallation {
  readonly manifest: ProviderManifest;
  readonly connection?: IntegrationConnection;
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
  readonly operations: readonly string[];
  create(installation: ProviderInstallation): ChannelProvider;
}

export interface RemoteProviderDefinition {
  readonly definition: UnsignedProviderManifest;
  readonly operations: ProviderOperations;
  readonly mapper: ProviderMapper;
  readonly client: (connection: IntegrationConnection) => IntegrationClient;
}

export function remoteProviderFactory(source: RemoteProviderDefinition): ProviderFactory {
  const factory: ProviderFactory = Object.freeze({
    id: source.definition.id,
    transport: 'remote',
    definition: source.definition,
    operations: Object.freeze(Object.values(source.operations)),
    create(installation: ProviderInstallation) {
      assertInstallation(factory, installation);
      const connection = validateProviderConnection(source.definition, requireConnection(installation));
      const missing = factory.operations.filter((operation) => !connection.endpoints[operation]);
      if (missing.length) throw new Error(`PROVIDER_OPERATION_ENDPOINT_MISSING:${source.definition.id}:${missing.join(',')}`);
      const client = source.client(connection);
      return new Provider(installation.manifest, client, createPorts(client, source.operations, source.mapper, connection.secret));
    },
  });
  return factory;
}

export function validateProviderConnection(definition: UnsignedProviderManifest, connection: IntegrationConnection): IntegrationConnection {
  const validated = validateConnection(connection);
  if (validated.healthOperation !== definition.healthOperation) throw new Error(`PROVIDER_HEALTH_OPERATION_MISMATCH:${definition.id}`);
  return validated;
}

export function requireConnection(installation: ProviderInstallation): IntegrationConnection {
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
  const same =
    actual.id === expected.id &&
    actual.kind === expected.kind &&
    actual.version === expected.version &&
    actual.apiVersion === expected.apiVersion &&
    actual.contractVersion === expected.contractVersion &&
    actual.healthOperation === expected.healthOperation &&
    actual.configSchema === expected.configSchema &&
    equal(actual.capabilities, expected.capabilities) &&
    equal(actual.permissions, expected.permissions) &&
    equal(actual.eventSubscriptions, expected.eventSubscriptions) &&
    equal(actual.secretRefs, expected.secretRefs) &&
    actual.webhookContract === expected.webhookContract &&
    JSON.stringify(actual.rateLimits) === JSON.stringify(expected.rateLimits) &&
    JSON.stringify(actual.timeout) === JSON.stringify(expected.timeout) &&
    JSON.stringify(actual.retryPolicy) === JSON.stringify(expected.retryPolicy) &&
    JSON.stringify(actual.circuitPolicy) === JSON.stringify(expected.circuitPolicy);
  if (!same) throw new Error(`PROVIDER_CONTRACT_MISMATCH:${expected.id}`);
}

function equal(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}
