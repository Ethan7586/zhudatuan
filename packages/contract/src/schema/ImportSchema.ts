import { array, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc } from './Primitives';

const error = strictObject({ row_number: number(), reason_code: string(), field: union([string(), nullSchema()]), detail: ContractJsonValueSchema });
const base = {
  id: string(),
  state: string(),
  total_count: number(),
  cursor_value: number(),
  success_count: number(),
  failure_count: number(),
  created_at: isoUtc,
  updated_at: isoUtc,
} as const;

export const importInput = strictObject({ objectRef: string(), sha256: string() });
export const importCreated = strictObject(base);
export const importRead = strictObject({
  ...base,
  validation_summary: ContractJsonValueSchema,
  last_error: union([string(), nullSchema()]),
  errors: array(error),
  report: optional(strictObject({ sha256: string(), size: number(), download: string() })),
});
