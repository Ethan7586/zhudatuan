import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';
import { OperatorIdentityDisplayHintSchema } from '@shop/contract';

export const MemberSchema = z.object({
  id: z.string().min(1), display_name: z.string().min(1), status: z.string().min(1), membership_id: z.string().min(1),
  employee_no: z.string().nullable(), membership_status: z.string().min(1), access_version: DatabaseIntegerSchema,
  joined_at: z.string().nullable(), principal_id: z.string().min(1), principal_version: DatabaseIntegerSchema,
  client: z.enum(['storefront', 'operator', 'store', 'supplier']), login_identity_bound: z.boolean(), reset_allowed: z.boolean(),
  mobile: z.string().min(1).nullable().optional(), mobile_masked: z.string().min(1).nullable().optional(),
  reset_block_reason: z.string().min(1).nullable(),
  governance_parent_membership_id: z.string().min(1).nullable().optional(),
  governance_parent_name: z.string().min(1).nullable().optional(),
  identity_display: z.optional(OperatorIdentityDisplayHintSchema),
}).passthrough();
export const MemberPageSchema = pageEnvelope(MemberSchema);
export type Member = z.infer<typeof MemberSchema>;
