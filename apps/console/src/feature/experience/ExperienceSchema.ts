import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const ExperienceSchema = z.object({
  id: z.string().min(1),
  scope_id: z.string().min(1),
  code: z.string().min(1),
  public_slug: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1),
  version: DatabaseIntegerSchema,
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  head_id: z.string().nullable().optional(),
  head_sequence: z.nullable(DatabaseIntegerSchema).optional(),
  head_configuration: z.unknown().nullable().optional(),
  head_validation_state: z.string().nullable().optional(),
  published_sequence: z.nullable(DatabaseIntegerSchema).optional(),
  domain: z.string().nullable().optional(),
  mall_id: z.string().nullable().optional(),
  pool_id: z.string().nullable().optional(),
  history: z
    .array(
      z.object({
        id: z.string().min(1),
        sequence: DatabaseIntegerSchema,
        configuration: z.unknown(),
        validationState: z.string().min(1),
        lifecycle: z.string().min(1),
      })
    )
    .default([]),
});

export const ExperiencePageSchema = pageEnvelope(ExperienceSchema);
export type Experience = z.infer<typeof ExperienceSchema>;
