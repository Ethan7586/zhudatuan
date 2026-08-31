import { remoteProviderFactory } from '@shop/providercore';
import { JdproductOperations } from './capability';
import { createJdproductClient } from './Client';
import { definition } from './Manifest';
import { JdproductMapper } from './Mapper';

export const JdproductProvider = remoteProviderFactory({ definition, operations: JdproductOperations, mapper: new JdproductMapper(), client: createJdproductClient });
