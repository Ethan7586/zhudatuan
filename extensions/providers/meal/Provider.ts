import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createCakeuncleClient } from '@shop/vendorcakeuncle';
import { definition } from './manifest';
import { MealMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'meal.menu.pull', price: 'meal.price.pull', stock: 'meal.inventory.pull', order: 'meal.order.submit', cancel: 'meal.order.cancel', tracking: 'meal.pickup.query', refund: 'meal.refund.submit', statement: 'meal.statement.pull', verification: 'meal.pickup.verify' });

export const MealProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(MealProvider, installation);
    const client = createCakeuncleClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new MealMapper(), requireConnection(installation).secret));
  },
});
