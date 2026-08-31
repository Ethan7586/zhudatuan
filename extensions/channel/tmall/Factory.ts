import { remoteProviderFactory } from '@shop/providercore';
import { TmallOperations } from './capability';
import { createTmallClient } from './Client';
import { definition } from './Manifest';
import { TmallMapper } from './Mapper';

export const TmallProvider = remoteProviderFactory({ definition, operations: TmallOperations, mapper: new TmallMapper(), client: createTmallClient });
