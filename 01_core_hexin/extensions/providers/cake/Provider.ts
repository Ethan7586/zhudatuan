import { Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
import { createCakeReadClient } from './CakeuncleClient';
import { definition } from './manifest';

export const CakeProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(CakeProvider, installation);
    const connection = requireConnection(installation);
    const client = createCakeReadClient(createCakeuncleClient(connection), connection);
    return new Provider(installation.manifest, client, Object.freeze({ catalog: client, price: client, stock: client }));
  },
});
