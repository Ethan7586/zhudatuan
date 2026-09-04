import { remoteProviderFactory } from '@shop/providercore';
import { JdproductCapabilities } from './capability';
import { createJdproductClient, JdproductMapper } from './integration';
import { definition } from './Manifest';

export const JdproductProvider = remoteProviderFactory({ definition, operations: JdproductCapabilities, mapper: new JdproductMapper(), client: createJdproductClient });
