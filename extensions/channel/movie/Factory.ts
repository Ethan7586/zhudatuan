import { remoteProviderFactory } from '@shop/providercore';
import { MovieCapabilities } from './capability';
import { createMovieClient } from './Client';
import { definition } from './Manifest';
import { MovieMapper } from './Mapper';

export const MovieProvider = remoteProviderFactory({ definition, operations: MovieCapabilities, mapper: new MovieMapper(), client: createMovieClient });
