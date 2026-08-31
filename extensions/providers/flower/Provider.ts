import type { ProviderPorts } from '@shop/contract';
import { Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';

import { createFlowerReadClient, FlowerReadClient, flowerEndpointConfiguration,
  type FlowerConnection, type FlowerTransport } from './FlowerClient';
import { FlowerMapper } from './Mapper';
import { definition } from './manifest';

export const FlowerProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(FlowerProvider, installation);
    const connection = requireConnection(installation);
    const client = createFlowerReadClient(createCakeuncleClient(connection), connection);
    return new Provider(installation.manifest, client, readPorts(client));
  },
});

/** Testable factory for the only capabilities proven by the public API. */
export function createFlowerPorts(transport: FlowerTransport, connection: FlowerConnection,
  mapper = new FlowerMapper(), now: () => number = Date.now): Pick<ProviderPorts, 'catalog' | 'price' | 'stock'> {
  const client = new FlowerReadClient(transport, flowerEndpointConfiguration(connection), mapper,
    connection.limits.totalDeadlineMs, now);
  return readPorts(client);
}

function readPorts(client: FlowerReadClient): Pick<ProviderPorts, 'catalog' | 'price' | 'stock'> {
  return Object.freeze({ catalog: client, price: client, stock: client });
}
