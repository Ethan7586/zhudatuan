import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
import { definition } from './manifest';
import { FoodvoucherMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'voucher.product.pull', order: 'voucher.issue', cancel: 'voucher.void', refund: 'voucher.refund.submit', statement: 'voucher.statement.pull', verification: 'voucher.verify' });

export const FoodvoucherProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(FoodvoucherProvider, installation);
    const client = createCakeuncleClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new FoodvoucherMapper(), requireConnection(installation).secret));
  },
});
