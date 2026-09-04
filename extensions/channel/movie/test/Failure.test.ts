import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { mapMovieError } from '../integration';
import { manifest } from '../Manifest';

it('fails movie closed without leaking raw errors', () => expect(() => assertProviderFailure(mapMovieError, 'MOVIE', manifest)).not.toThrow());
