import { remoteProviderFactory } from '@shop/providercore';
import { JdproductCapabilities } from './capability';
import { createJdproductClient } from './Client';
import { definition } from './Manifest';
import { JdproductMapper } from './Mapper';

export const JdproductProvider = remoteProviderFactory({ definition, operations: JdproductCapabilities, mapper: new JdproductMapper(), client: createJdproductClient });
