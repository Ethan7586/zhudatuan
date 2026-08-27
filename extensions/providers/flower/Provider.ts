import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
import { definition } from './manifest';
import { FlowerMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'flower.product.pull', stock: 'flower.slot.pull', order: 'flower.order.submit', cancel: 'flower.order.cancel', tracking: 'flower.delivery.pull', refund: 'flower.refund.submit', statement: 'flower.statement.pull' });

export const FlowerProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(FlowerProvider, installation);
    const client = createCakeuncleClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new FlowerMapper(), requireConnection(installation).secret));
  },
});
