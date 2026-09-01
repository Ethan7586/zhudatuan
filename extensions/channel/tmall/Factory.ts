import { remoteProviderFactory } from '@shop/providercore';
import { TmallCapabilities } from './capability';
import { createTmallClient } from './Client';
import { definition } from './Manifest';
import { TmallMapper } from './Mapper';

export const TmallProvider = remoteProviderFactory({ definition, operations: TmallCapabilities, mapper: new TmallMapper(), client: createTmallClient });
