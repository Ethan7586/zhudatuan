import { remoteProviderFactory } from '@shop/providercore';
import { BookCapabilities } from './capability';
import { BookMapper, createBookClient } from './integration';
import { definition } from './Manifest';

export const BookProvider = remoteProviderFactory({ definition, operations: BookCapabilities, mapper: new BookMapper(), client: createBookClient });
