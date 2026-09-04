import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createJdClient } from '@shop/vendorjd';
import { definition } from './manifest';
import { JdfreshMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'fresh.catalog.pull', stock: 'fresh.inventory.pull', order: 'fresh.order.submit', cancel: 'fresh.order.cancel', tracking: 'fresh.delivery.pull', refund: 'fresh.refund.submit', statement: 'fresh.statement.pull' });

export const JdfreshProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(JdfreshProvider, installation);
    const client = createJdClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new JdfreshMapper(), requireConnection(installation).secret));
  },
});
