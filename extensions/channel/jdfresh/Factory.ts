import { remoteProviderFactory } from '@shop/providercore';
import { JdfreshOperations } from './capability';
import { createJdfreshClient } from './Client';
import { definition } from './Manifest';
import { JdfreshMapper } from './Mapper';

export const JdfreshProvider = remoteProviderFactory({ definition, operations: JdfreshOperations, mapper: new JdfreshMapper(), client: createJdfreshClient });
