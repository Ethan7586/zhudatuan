<<<<<<< HEAD
<<<<<<< HEAD
import { Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
import { createCakeReadClient } from './CakeuncleClient';
import { definition } from './manifest';
=======
import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
=======
import { Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
import { createCakeReadClient } from './CakeuncleClient';
import { definition } from './manifest';
<<<<<<< HEAD
import { CakeMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'cake.product.pull', stock: 'cake.slot.pull', order: 'cake.order.submit', cancel: 'cake.order.cancel', tracking: 'cake.delivery.pull', refund: 'cake.refund.submit', statement: 'cake.statement.pull' });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

export const CakeProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(CakeProvider, installation);
<<<<<<< HEAD
<<<<<<< HEAD
    const connection = requireConnection(installation);
    const client = createCakeReadClient(createCakeuncleClient(connection), connection);
    return new Provider(installation.manifest, client, Object.freeze({ catalog: client, price: client, stock: client }));
=======
    const client = createCakeuncleClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new CakeMapper(), requireConnection(installation).secret));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    const connection = requireConnection(installation);
    const client = createCakeReadClient(createCakeuncleClient(connection), connection);
    return new Provider(installation.manifest, client, Object.freeze({ catalog: client, price: client, stock: client }));
>>>>>>> 018b2a71 (chore(release): capture current production source)
  },
});
