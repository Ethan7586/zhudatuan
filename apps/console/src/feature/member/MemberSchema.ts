import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const MemberSchema = z.object({
  id: z.string().min(1), display_name: z.string().min(1), status: z.string().min(1), membership_id: z.string().min(1),
  employee_no: z.string().nullable(), membership_status: z.string().min(1), access_version: DatabaseIntegerSchema,
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  joined_at: z.string().nullable(), principal_id: z.string().min(1), principal_version: DatabaseIntegerSchema,
  client: z.enum(['storefront', 'operator', 'store', 'supplier']), login_identity_bound: z.boolean(), reset_allowed: z.boolean(),
  reset_block_reason: z.string().min(1).nullable(),
=======
  joined_at: z.string().nullable(),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  joined_at: z.string().nullable(), principal_id: z.string().min(1), principal_version: DatabaseIntegerSchema,
  client: z.enum(['storefront', 'operator', 'store', 'supplier']), login_identity_bound: z.boolean(), reset_allowed: z.boolean(),
  reset_block_reason: z.string().min(1).nullable(),
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  joined_at: z.string().nullable(),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}).passthrough();
export const MemberPageSchema = pageEnvelope(MemberSchema);
export type Member = z.infer<typeof MemberSchema>;
