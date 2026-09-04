import { createPorts, Provider, assertInstallation, requireConnection, type ProviderFactory, type ProviderInstallation } from '@shop/providercore';
import { createWanlianClient } from '@shop/vendorwanlian';
import { definition } from './manifest';
import { MovieMapper } from './Mapper';

const operations = Object.freeze({ catalog: 'movie.show.pull', stock: 'movie.seat.pull', order: 'movie.order.submit', cancel: 'movie.order.cancel', refund: 'movie.refund.submit', statement: 'movie.statement.pull', verification: 'movie.verify' });

export const MovieProvider: ProviderFactory = Object.freeze({
  id: definition.id,
  transport: 'remote',
  definition,
  create(installation: ProviderInstallation) {
    assertInstallation(MovieProvider, installation);
    const client = createWanlianClient(requireConnection(installation));
    return new Provider(installation.manifest, client, createPorts(client, operations, new MovieMapper(), requireConnection(installation).secret));
  },
});
