import { remoteProviderFactory } from '@shop/providercore';
import { JdfreshCapabilities } from './capability';
import { createJdfreshClient } from './Client';
import { definition } from './Manifest';
import { JdfreshMapper } from './Mapper';

export const JdfreshProvider = remoteProviderFactory({ definition, operations: JdfreshCapabilities, mapper: new JdfreshMapper(), client: createJdfreshClient });
