import { remoteProviderFactory } from '@shop/providercore';
import { JdfreshCapabilities } from './capability';
import { createJdfreshClient, JdfreshMapper } from './integration';
import { definition } from './Manifest';

export const JdfreshProvider = remoteProviderFactory({ definition, operations: JdfreshCapabilities, mapper: new JdfreshMapper(), client: createJdfreshClient });
