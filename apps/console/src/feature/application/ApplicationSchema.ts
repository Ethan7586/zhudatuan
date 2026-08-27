import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const ApplicationSchema = z.object({
  id: z.string().min(1), code: z.string().min(1), public_slug: z.string().min(1), name: z.string().min(1),
  status: z.string().min(1), version: DatabaseIntegerSchema, updated_at: z.string().min(1),
  head_sequence: z.nullable(DatabaseIntegerSchema).optional(), head_validation_state: z.string().nullable().optional(),
  published_sequence: z.nullable(DatabaseIntegerSchema).optional(), domain: z.string().nullable().optional(),
  mall_id: z.string().nullable().optional(), pool_id: z.string().nullable().optional(),
});

export const ApplicationPageSchema = pageEnvelope(ApplicationSchema);
export type Application = z.infer<typeof ApplicationSchema>;
