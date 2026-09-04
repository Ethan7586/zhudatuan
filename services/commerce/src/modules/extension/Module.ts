import { defineModule } from '../../bootstrap/DefinedModule';
import { EXTENSION_REGISTRY } from '../../bootstrap/ExtensionRegistry';
import { PgExtensionRepository } from './infrastructure/persistence/PgExtensionRepository';
import { Manifest } from './Manifest';
import { EXTENSION_REGISTRY_PORT } from './public/ExtensionRegistry';
import { InstallationsReadHandler } from './application/handler/InstallationsReadHandler';
import { PgInstallationRepository } from './infrastructure/persistence/PgInstallationRepository';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { createProviderJobs } from './interface/job/JobFactory';
import { extensionRegistryAdapter } from './infrastructure/adapter/ExtensionRegistryAdapter';
import { MANIFEST_VERIFIER } from '../../bootstrap/SignatureVerifier';
import { EXTENSION_LOADER } from './application/port/ExtensionLoader';

export const ExtensionModule = defineModule(Manifest, {
  providerJobs: createProviderJobs,
  handlers: () => [new InstallationsReadHandler(new PgInstallationRepository(new PgTransactionAccess()))],
  ports: (context) => [{
    token: EXTENSION_REGISTRY_PORT,
    value: extensionRegistryAdapter(
      context.service(EXTENSION_REGISTRY),
      new PgExtensionRepository(new PgTransactionAccess()),
      context.service(MANIFEST_VERIFIER),
      context.service(EXTENSION_LOADER)
    ),
  }],
});
