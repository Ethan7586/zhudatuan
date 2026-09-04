import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const InvitationRecordSchema = z.strictObject({
  id: z.string().min(1),
  scope: z.string().min(1),
  scope_name: z.string().min(1),
  label: z.string().min(1),
  governance_level: z.enum(['administrator', 'senior_administrator']),
  created_by: z.string().min(1),
  created_by_name: z.string().min(1).nullable(),
  accepted_membership_id: z.string().min(1).nullable(),
  invitee_name: z.string().min(1).nullable(),
  destination_masked: z.string().min(1).nullable(),
  max_uses: z.number().int().positive(),
  use_count: z.number().int().nonnegative(),
  starts_at: z.iso.datetime(),
  expires_at: z.iso.datetime(),
  accepted_at: z.iso.datetime().nullable(),
  status: z.enum(['active', 'used', 'expired', 'revoked']),
  created_at: z.iso.datetime(),
  version: DatabaseIntegerSchema,
});

export const InvitationRecordsPageSchema = pageEnvelope(InvitationRecordSchema);
export type InvitationRecord = z.infer<typeof InvitationRecordSchema>;
