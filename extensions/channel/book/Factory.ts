import { remoteProviderFactory } from '@shop/providercore';
import { BookOperations } from './capability';
import { createBookClient } from './Client';
import { definition } from './Manifest';
import { BookMapper } from './Mapper';

export const BookProvider = remoteProviderFactory({ definition, operations: BookOperations, mapper: new BookMapper(), client: createBookClient });
