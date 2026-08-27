import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createJdClient } from '@shop/vendorjd';
import { definition } from './manifest';
import { JdproductMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'catalog.pull', price: 'price.pull', stock: 'inventory.pull', order: 'order.submit', cancel: 'order.cancel', tracking: 'logistics.pull', refund: 'refund.submit', statement: 'statement.pull' });

export const JdproductProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(JdproductProvider, installation);
    const client = createJdClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new JdproductMapper(), requireConnection(installation).secret));
  },
});
