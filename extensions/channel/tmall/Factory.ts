import { remoteProviderFactory } from '@shop/providercore';
import { TmallCapabilities } from './capability';
import { createTmallClient, TmallMapper } from './integration';
import { definition } from './Manifest';

export const TmallProvider = remoteProviderFactory({ definition, operations: TmallCapabilities, mapper: new TmallMapper(), client: createTmallClient });
