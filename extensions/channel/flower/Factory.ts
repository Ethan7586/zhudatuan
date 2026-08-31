import { remoteProviderFactory } from '@shop/providercore';
import { FlowerOperations } from './capability';
import { createFlowerClient } from './Client';
import { definition } from './Manifest';
import { FlowerMapper } from './Mapper';

export const FlowerProvider = remoteProviderFactory({ definition, operations: FlowerOperations, mapper: new FlowerMapper(), client: createFlowerClient });
