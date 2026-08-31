import { array, boolean, int, literal, minLength, nonnegative, optional, positive, regex, strictObject, string, union, type ZodMiniType } from 'zod/mini';

export type EntityId<TKind extends string> = string & { readonly entity: TKind };
export type IsoUtc = string & { readonly isoUtc: true };
export type Currency = string & { readonly currency: true };

export const id = <TKind extends string>(): ZodMiniType<EntityId<TKind>> => string().check(minLength(3), regex(/^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$/)) as unknown as ZodMiniType<EntityId<TKind>>;
export const isoUtc = string().check(regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/));
export const currency = string().check(regex(/^[A-Z]{3}$/));
export const integer = int();
export const unsigned = int().check(nonnegative());
// Persisted aggregates are created at version zero; optimistic command tokens
// are intentionally stricter and must name an already-observed revision.
export const version = unsigned;
export const expectedVersion = int().check(positive());
export const basisPoints = int().check(nonnegative());
export const pageQuery = { cursor: optional(string()), limit: optional(union([int().check(positive()), string().check(regex(/^[1-9]\d*$/))])) } as const;
export const pageOutput = <TItem>(item: ZodMiniType<TItem>) => strictObject({ items: array(item), count: unsigned, nextCursor: optional(string()) });
export const empty = strictObject({});
export const decision = literal(['approve', 'reject']);
export const enabled = boolean();
