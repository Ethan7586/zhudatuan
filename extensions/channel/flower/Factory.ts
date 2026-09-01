import { remoteProviderFactory } from '@shop/providercore';
import { FlowerCapabilities } from './capability';
import { createFlowerClient } from './Client';
import { definition } from './Manifest';
import { FlowerMapper } from './Mapper';

export const FlowerProvider = remoteProviderFactory({ definition, operations: FlowerCapabilities, mapper: new FlowerMapper(), client: createFlowerClient });
