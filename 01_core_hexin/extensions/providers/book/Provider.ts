import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createWenxuanClient } from '@shop/vendorwenxuan';
import { definition } from './manifest';
import { BookMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'book.catalog.pull', price: 'book.price.pull', stock: 'book.inventory.pull', order: 'book.order.submit', cancel: 'book.order.cancel', tracking: 'book.shipment.pull', refund: 'book.return.submit', statement: 'book.statement.pull' });

export const BookProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(BookProvider, installation);
    const client = createWenxuanClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new BookMapper(), requireConnection(installation).secret));
  },
});
