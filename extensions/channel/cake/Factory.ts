import { remoteProviderFactory } from '@shop/providercore';
import { CakeOperations } from './capability';
import { createCakeClient } from './Client';
import { definition } from './Manifest';
import { CakeMapper } from './Mapper';

export const CakeProvider = remoteProviderFactory({ definition, operations: CakeOperations, mapper: new CakeMapper(), client: createCakeClient });
