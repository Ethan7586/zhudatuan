import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

const ApplicationNameSchema = z.string().trim().min(1).max(255);
const ApplicationCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{2,31}$/);
const ApplicationPublicSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{2,47}$/);

export const ApplicationSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  public_slug: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1),
  version: DatabaseIntegerSchema,
  updated_at: z.string().min(1),
  head_sequence: z.nullable(DatabaseIntegerSchema).optional(),
  head_validation_state: z.string().nullable().optional(),
  published_sequence: z.nullable(DatabaseIntegerSchema).optional(),
  domain: z.string().nullable().optional(),
  mall_id: z.string().nullable().optional(),
  pool_id: z.string().nullable().optional(),
});

export const ApplicationPageSchema = pageEnvelope(ApplicationSchema);
export const ApplicationCreateDraftSchema = z.object({
  name: ApplicationNameSchema,
  code: ApplicationCodeSchema,
  publicSlug: ApplicationPublicSlugSchema,
});
export const ApplicationEditDraftSchema = z.object({ name: ApplicationNameSchema });
export const ApplicationCopyDraftSchema = z.object({
  name: ApplicationNameSchema,
  code: ApplicationCodeSchema,
  publicSlug: ApplicationPublicSlugSchema,
  reason: z.string().trim().min(1).max(500),
});
export type Application = z.infer<typeof ApplicationSchema>;
export type ApplicationCreateDraft = z.infer<typeof ApplicationCreateDraftSchema>;
export type ApplicationEditDraft = z.infer<typeof ApplicationEditDraftSchema>;
export type ApplicationCopyDraft = z.infer<typeof ApplicationCopyDraftSchema>;
