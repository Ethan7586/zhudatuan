import { remoteProviderFactory } from '@shop/providercore';
import { FlowerCapabilities } from './capability';
import { createFlowerClient, FlowerMapper } from './integration';
import { definition } from './Manifest';

export const FlowerProvider = remoteProviderFactory({ definition, operations: FlowerCapabilities, mapper: new FlowerMapper(), client: createFlowerClient });
