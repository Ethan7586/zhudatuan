import { remoteProviderFactory } from '@shop/providercore';
import { CakeCapabilities } from './capability';
import { createCakeClient } from './Client';
import { definition } from './Manifest';
import { CakeMapper } from './Mapper';

export const CakeProvider = remoteProviderFactory({ definition, operations: CakeCapabilities, mapper: new CakeMapper(), client: createCakeClient });
