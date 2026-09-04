import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createTmallClient } from '@shop/vendortmall';
import { definition } from './manifest';
import { TmallmarketMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'catalog.pull', price: 'price.pull', stock: 'inventory.pull', order: 'order.submit', cancel: 'order.cancel', tracking: 'logistics.pull', refund: 'refund.submit', statement: 'statement.pull' });

export const TmallmarketProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(TmallmarketProvider, installation);
    const client = createTmallClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new TmallmarketMapper(), requireConnection(installation).secret));
  },
});
