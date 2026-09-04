import { remoteProviderFactory } from '@shop/providercore';
import { CakeCapabilities } from './capability';
import { CakeMapper, createCakeClient } from './integration';
import { definition } from './Manifest';

export const CakeProvider = remoteProviderFactory({ definition, operations: CakeCapabilities, mapper: new CakeMapper(), client: createCakeClient });
