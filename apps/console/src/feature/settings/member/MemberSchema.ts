import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../../shared/schema/PageEnvelope';

export const MemberSchema = z
  .object({
    id: z.string().min(1),
    display_name: z.string().min(1),
    status: z.string().min(1),
    membership_id: z.string().min(1),
    employee_no: z.string().nullable(),
    membership_status: z.string().min(1),
    access_version: DatabaseIntegerSchema,
    joined_at: z.string().nullable(),
  })
  .passthrough();
export const MemberPageSchema = pageEnvelope(MemberSchema);
export type Member = z.infer<typeof MemberSchema>;
