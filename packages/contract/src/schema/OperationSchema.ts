import { minLength, optional, strictObject, string, type ZodMiniObject, type ZodMiniString, type ZodMiniType } from 'zod/mini';
import type { ExactOperationInput } from './index';

export function exactOperationInputFrom<const TKeys extends readonly string[]>(schema: ZodMiniType, pathKeys: TKeys, bodyRequired: boolean): ZodMiniType<ExactOperationInput<TKeys[number]>> {
  const shared = bodyRequired ? { body: schema } : { query: optional(schema) };
  const value = pathKeys.length === 0 ? strictObject(shared) : strictObject({ path: pathSchema(pathKeys), ...shared });
  return value as unknown as ZodMiniType<ExactOperationInput<TKeys[number]>>;
}

export function exactOperationOutputFrom<TSchema extends ZodMiniType>(schema: TSchema): TSchema {
  return schema;
}

function pathSchema(keys: readonly string[]): ZodMiniObject<Record<string, ZodMiniString>> {
  return strictObject(Object.fromEntries(keys.map((key) => [key, string().check(minLength(1))])));
}
