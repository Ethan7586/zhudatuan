import { expect, it } from 'vitest';
import { assertProviderMappingFailure } from '@shop/providercore/test';
import { MovieMapper } from '../integration';

it('rejects incomplete movie records', () => expect(() => assertProviderMappingFailure(new MovieMapper())).not.toThrow());

it('rejects shows without selected seats', () => expect(() => new MovieMapper().objects([{ tradeNo: 'M-1', updatedAt: '2026-09-06T00:00:00Z', cityId: '310000', cinemaId: 'C-1', movieId: 'F-1', showId: 'S-1', seats: [], priceCent: 1 }], 'mapping')).toThrow('MOVIE_SEATS_INVALID'));
