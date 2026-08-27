<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import type { ProviderPorts } from '@shop/contract';
import { Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';

import { createFlowerReadClient, FlowerReadClient, flowerEndpointConfiguration,
  type FlowerConnection, type FlowerTransport } from './FlowerClient';
import { FlowerMapper } from './Mapper';
import { definition } from './manifest';
=======
import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
=======
import type { ProviderPorts } from '@shop/contract';
import { Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { createCakeuncleClient } from '@shop/vendorcakeuncle';

<<<<<<< HEAD
const operations = Object.freeze({ catalog: 'flower.product.pull', stock: 'flower.slot.pull', order: 'flower.order.submit', cancel: 'flower.order.cancel', tracking: 'flower.delivery.pull', refund: 'flower.refund.submit', statement: 'flower.statement.pull' });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { createFlowerReadClient, FlowerReadClient, flowerEndpointConfiguration,
  type FlowerConnection, type FlowerTransport } from './FlowerClient';
import { FlowerMapper } from './Mapper';
import { definition } from './manifest';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
import { definition } from './manifest';
import { FlowerMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'flower.product.pull', stock: 'flower.slot.pull', order: 'flower.order.submit', cancel: 'flower.order.cancel', tracking: 'flower.delivery.pull', refund: 'flower.refund.submit', statement: 'flower.statement.pull' });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

export const FlowerProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(FlowerProvider, installation);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    const client = createCakeuncleClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new FlowerMapper(), requireConnection(installation).secret));
  },
});
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
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
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
