import { remoteProviderFactory } from '@shop/providercore';
import { MovieCapabilities } from './capability';
import { createMovieClient, MovieMapper } from './integration';
import { definition } from './Manifest';

export const MovieProvider = remoteProviderFactory({ definition, operations: MovieCapabilities, mapper: new MovieMapper(), client: createMovieClient });
