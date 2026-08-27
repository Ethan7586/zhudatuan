import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
import { definition } from './manifest';
import { CakeMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'cake.product.pull', stock: 'cake.slot.pull', order: 'cake.order.submit', cancel: 'cake.order.cancel', tracking: 'cake.delivery.pull', refund: 'cake.refund.submit', statement: 'cake.statement.pull' });

export const CakeProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(CakeProvider, installation);
    const client = createCakeuncleClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new CakeMapper(), requireConnection(installation).secret));
  },
});
