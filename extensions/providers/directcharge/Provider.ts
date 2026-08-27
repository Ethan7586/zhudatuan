import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createWanlianClient } from '@shop/vendorwanlian';
import { definition } from './manifest';
import { DirectchargeMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'charge.product.pull', order: 'charge.submit', tracking: 'charge.query', refund: 'charge.refund.submit', statement: 'charge.statement.pull', verification: 'charge.verify' });

export const DirectchargeProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(DirectchargeProvider, installation);
    const client = createWanlianClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new DirectchargeMapper(), requireConnection(installation).secret));
  },
});
