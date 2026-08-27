import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

const NullableInteger = z.nullable(DatabaseIntegerSchema).optional();
export const ImportJobSchema = z.object({
  id: z.string().min(1), state: z.string().min(1), total_count: NullableInteger, cursor_value: NullableInteger,
  success_count: NullableInteger, failure_count: NullableInteger, validation_summary: z.unknown().optional(),
  last_error: z.string().nullable().optional(), report_object_ref: z.string().nullable().optional(),
  report_sha256: z.string().nullable().optional(), report_size: NullableInteger,
  created_at: z.string().min(1), updated_at: z.string().min(1),
  errors: z.array(z.object({ row_number: DatabaseIntegerSchema, reason_code: z.string().min(1),
    field: z.string().nullable().optional(), detail: z.string().nullable().optional() }).passthrough()),
}).passthrough();
export type ImportJob = z.infer<typeof ImportJobSchema>;
export type ImportKind = 'member' | 'catalog' | 'voucher';
export type ImportError = ImportJob['errors'][number];
