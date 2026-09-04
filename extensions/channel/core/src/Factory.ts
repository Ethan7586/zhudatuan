import { manifestPayload, type ChannelProvider, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import type { ProviderPorts } from '@shop/contract';
import type { ProviderMapper } from './Mapper';
import { createPorts, type ProviderOperations } from './PortFactory';
import { Provider } from './Provider';
import type { RequestExecutor } from './RequestExecutor';
import { validateConnection, type IntegrationConnection } from './integration';

export interface ProviderInstallation {
  readonly manifest: ProviderManifest;
  readonly connection?: IntegrationConnection;
  readonly local?: LocalProviderInstallation;
}

export interface LocalProviderInstallation {
  readonly ports: Partial<ProviderPorts>;
  health(): Promise<boolean>;
}

export interface LocalProviderRuntime {
  readonly scope: string;
  invoke(operation: string, arguments_: readonly unknown[]): Promise<unknown>;
}

export interface ProviderFactory {
  readonly id: string;
  readonly transport: 'remote' | 'local';
  readonly definition: UnsignedProviderManifest;
  readonly operations: readonly string[];
  readonly provision?: (runtime: LocalProviderRuntime) => LocalProviderInstallation;
  create(installation: ProviderInstallation): ChannelProvider;
}

export interface RemoteProviderDefinition {
  readonly definition: UnsignedProviderManifest;
  readonly operations: ProviderOperations;
  readonly mapper: ProviderMapper;
  readonly client: (connection: IntegrationConnection) => RequestExecutor;
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

export function requireProvisioner(factory: ProviderFactory): NonNullable<ProviderFactory['provision']> {
  if (factory.transport !== 'local' || !factory.provision) throw new Error(`PROVIDER_LOCAL_PROVISIONER_MISSING:${factory.id}`);
  return factory.provision;
}

export function assertInstallation(factory: ProviderFactory, installation: ProviderInstallation): void {
  const actual = installation.manifest;
  const expected = factory.definition;
  if (manifestPayload(actual) !== manifestPayload({ ...expected, signature: actual.signature })) throw new Error(`PROVIDER_CONTRACT_MISMATCH:${expected.id}`);
}
