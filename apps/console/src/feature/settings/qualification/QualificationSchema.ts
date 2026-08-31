import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../../shared/schema/PageEnvelope';

export const QualificationPolicySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    status: z.string().min(1),
    active_version: z.nullable(DatabaseIntegerSchema),
    updated_at: z.string().min(1),
    published_at: z.string().nullable(),
    rule: z.record(z.string(), z.unknown()).nullable(),
  })
  .passthrough();
export const QualificationPageSchema = pageEnvelope(QualificationPolicySchema);
export type QualificationPolicy = z.infer<typeof QualificationPolicySchema>;
