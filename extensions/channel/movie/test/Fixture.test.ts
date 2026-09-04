import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderFixture } from '@shop/providercore/test';
import { MovieCatalog } from '../Catalog';
import { validateSeatLock } from '../capability';
import { MovieMapper } from '../integration';
import { definition } from '../Manifest';

it('maps the movie catalog fixture', () => expect(() => { assertProviderCatalog(definition, MovieCatalog); assertProviderFixture(new MovieMapper()); }).not.toThrow());

it('normalizes cinema, show and seats and rejects expired locks or price drift', () => {
  const [record] = new MovieMapper().objects([{ tradeNo: 'MOVIE-1', updatedAt: '2026-09-06T00:00:00Z', cityId: '310000', cinemaId: 'CINEMA-1', movieId: 'FILM-1', showId: 'SHOW-1', seats: ['5排6座'], priceCent: 4500 }], 'fixture');
  expect(record).toMatchObject({ externalId: 'MOVIE-1', payload: { cinemaId: 'CINEMA-1', showId: 'SHOW-1', seats: ['5排6座'] } });
  expect(() => validateSeatLock({ expiresAt: '2026-09-06T00:10:00Z', quotedMinor: 4500 }, 4600, Date.parse('2026-09-06T00:00:00Z'))).toThrow('MOVIE_PRICE_DRIFT');
  expect(() => validateSeatLock({ expiresAt: '2026-09-06T00:00:00Z', quotedMinor: 4500 }, 4500, Date.parse('2026-09-06T00:00:01Z'))).toThrow('MOVIE_SEAT_LOCK_EXPIRED');
});
