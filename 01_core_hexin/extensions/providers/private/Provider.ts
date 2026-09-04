import { Provider, assertInstallation, requireLocal, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { definition } from './manifest';

export const PrivateProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'local',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(PrivateProvider, installation);
    const local = requireLocal(installation);
    return new Provider(installation.manifest, {
      health: () => local.health(),
      circuitState: () => 'closed',
    }, local.ports);
  },
});
