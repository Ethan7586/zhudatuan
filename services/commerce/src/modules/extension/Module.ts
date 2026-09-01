import { defineModule } from '../../bootstrap/DefinedModule';
import { PgExtensionRepository } from './infrastructure/persistence/PgExtensionRepository';
import type { ExtensionRepository } from './application/port/ExtensionLoader';
import { Manifest } from './Manifest';
import { InstallExtension } from './application/service/InstallExtension';
import { EnableExtension } from './application/service/EnableExtension';
import { DisableExtension } from './application/service/DisableExtension';
import { ContractPolicy } from './domain/policy/ContractPolicy';
import { CHANNEL_EXTENSION_PORT, type ChannelExtensionPort } from './public/ChannelExtensionPort';
import type { ManifestVerifier } from '../../bootstrap/SignatureVerifier';
import type { ExtensionLoader } from './application/port/ExtensionLoader';
import { InstallationsReadHandler } from './application/handler/InstallationsReadHandler';
import { PgInstallationRepository } from './infrastructure/persistence/PgInstallationRepository';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { createProviderJobs } from './interface/job/JobFactory';
export { InstallExtension } from './application/service/InstallExtension';
export { EnableExtension } from './application/service/EnableExtension';
export { DisableExtension } from './application/service/DisableExtension';
export { EXTENSION_LOADER } from './application/port/ExtensionLoader';
export type { ExtensionCandidate, ExtensionStateSink } from './application/port/ExtensionLoader';
export { ContractPolicy } from './domain/policy/ContractPolicy';
const extensionRepository: ExtensionRepository = new PgExtensionRepository(new PgTransactionAccess());
export const channelExtensionPort: ChannelExtensionPort = Object.freeze({
  repository: extensionRepository,
  install: (verifier: ManifestVerifier, loader: ExtensionLoader) => new InstallExtension(extensionRepository, verifier, new ContractPolicy(), loader),
  enable: () => new EnableExtension(extensionRepository),
  disable: () => new DisableExtension(extensionRepository),
});
export const ExtensionModule = defineModule(Manifest, {
  providerJobs: createProviderJobs,
  handlers: () => [new InstallationsReadHandler(new PgInstallationRepository(new PgTransactionAccess()))],
  ports: [{ token: CHANNEL_EXTENSION_PORT, value: channelExtensionPort }],
});
