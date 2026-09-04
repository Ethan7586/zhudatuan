import { Provider, assertInstallation, requireLocal, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { SupplierConfig } from './Config';
import { createSupplierInstallation, SupplierClient } from './integration';
import { definition } from './Manifest';

export const SupplierProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'local',
  definition,
  operations: Object.freeze([]),
  provision: createSupplierInstallation,
  create(installation: ProviderInstallation) {
    assertInstallation(SupplierProvider, installation);
    const local = SupplierConfig.validate(requireLocal(installation));
    return new Provider(installation.manifest, new SupplierClient(local), local.ports);
  },
});
