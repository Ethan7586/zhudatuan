import { remoteProviderFactory } from '@shop/providercore';
import { MovieOperations } from './capability';
import { createMovieClient } from './Client';
import { definition } from './Manifest';
import { MovieMapper } from './Mapper';

export const MovieProvider = remoteProviderFactory({ definition, operations: MovieOperations, mapper: new MovieMapper(), client: createMovieClient });
