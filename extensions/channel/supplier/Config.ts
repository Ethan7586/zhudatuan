import type { LocalProviderInstallation } from '@shop/providercore';
import { definition } from './Manifest';

export const SupplierConfig = Object.freeze({
  schema: definition.configSchema,
  secretRefs: definition.secretRefs,
  validate(local: LocalProviderInstallation) {
    if (!Object.keys(local.ports).length) throw new Error('SUPPLIER_PROVIDER_PORTS_MISSING');
    return local;
  },
});
