import type { JsonObject, JsonValue } from '@shop/contract';
import { wanlianReference, wanlianTimestamp } from '@shop/providerwanliancore';
import { CanonicalSourceMapper } from '@shop/providercore';

export class MovieMapper extends CanonicalSourceMapper {
  override objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return super.objects(value.map((record) => canonical(record)), code);
  }
}

function canonical(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('MOVIE_RECORD_INVALID');
  const source = value as JsonObject;
  if (source.externalId !== undefined) return source;
  return Object.freeze({ externalId: wanlianReference(source), version: wanlianTimestamp(source), payload: Object.freeze({ cityId: text(source.cityId, 'MOVIE_CITY_INVALID'), cinemaId: text(source.cinemaId, 'MOVIE_CINEMA_INVALID'), movieId: text(source.movieId, 'MOVIE_TITLE_INVALID'), showId: text(source.showId, 'MOVIE_SHOW_INVALID'), seats: strings(source.seats, 'MOVIE_SEATS_INVALID'), priceMinor: positiveInteger(source.priceCent, 'MOVIE_PRICE_INVALID') }) });
}

function text(value: JsonValue | undefined, code: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value.trim(); }
function strings(value: JsonValue | undefined, code: string): readonly string[] { if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || !item.trim())) throw new Error(code); return Object.freeze(value.map(String)); }
function positiveInteger(value: JsonValue | undefined, code: string): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(code); return value; }
