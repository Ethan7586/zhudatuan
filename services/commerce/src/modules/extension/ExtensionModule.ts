import { defineModule } from '../../bootstrap/DefinedModule';
import { extensionRoutes } from './interface/http/ExtensionRoutes';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { PgExtensionRepository } from './infrastructure/persistence/PgExtensionRepository';
import type { ExtensionRepository } from './application/port/ExtensionLoader';
import { Manifest } from './Manifest';
import { InstallExtension } from './application/command/InstallExtension';
import { EnableExtension } from './application/command/EnableExtension';
import { DisableExtension } from './application/command/DisableExtension';
import { ContractPolicy } from './domain/policy/ContractPolicy';
import { CHANNEL_EXTENSION_PORT, type ChannelExtensionPort } from './public/ChannelExtensionPort';
import type { ManifestVerifier } from '../../bootstrap/SignatureVerifier';
import type { ExtensionLoader } from './application/port/ExtensionLoader';
export { InstallExtension } from './application/command/InstallExtension';
export { EnableExtension } from './application/command/EnableExtension';
export { DisableExtension } from './application/command/DisableExtension';
export { EXTENSION_LOADER } from './application/port/ExtensionLoader';
export type { ExtensionCandidate, ExtensionRepositoryFactory, ExtensionStateSink } from './application/port/ExtensionLoader';
export { ContractPolicy } from './domain/policy/ContractPolicy';
export function extensionRepository(database: OperationDatabase): ExtensionRepository {
  return new PgExtensionRepository(database);
}
export const channelExtensionPort: ChannelExtensionPort = Object.freeze({
  repositories: extensionRepository,
  install: (verifier: ManifestVerifier, loader: ExtensionLoader) => new InstallExtension(extensionRepository, verifier, new ContractPolicy(), loader),
  enable: () => new EnableExtension(extensionRepository),
  disable: () => new DisableExtension(extensionRepository),
});
export const ExtensionModule = defineModule(Manifest, extensionRoutes, [{ token: CHANNEL_EXTENSION_PORT, value: channelExtensionPort }]);
