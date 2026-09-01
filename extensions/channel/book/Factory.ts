import { remoteProviderFactory } from '@shop/providercore';
import { BookCapabilities } from './capability';
import { createBookClient } from './Client';
import { definition } from './Manifest';
import { BookMapper } from './Mapper';

export const BookProvider = remoteProviderFactory({ definition, operations: BookCapabilities, mapper: new BookMapper(), client: createBookClient });
