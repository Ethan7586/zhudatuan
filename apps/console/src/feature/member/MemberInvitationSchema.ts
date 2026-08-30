import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

export const MemberInvitationDraftSchema = z.strictObject({
  label: z.string().trim().min(2).max(80),
  maxUses: z.coerce.number().int().min(1).max(500),
  validityDays: z.coerce.number().int().min(1).max(90),
});

export const MemberInvitationCommandSchema = z.strictObject({
  label: z.string().trim().min(2).max(80),
  maxUses: z.number().int().min(1).max(500),
  expiresAt: z.iso.datetime(),
});

export const MemberInvitationReceiptSchema = z.strictObject({
  id: z.string().min(1),
  code: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  label: z.string().min(2).max(80),
  target: z.literal('console'),
  max_uses: z.number().int().min(1).max(500),
  use_count: z.number().int().nonnegative(),
  starts_at: z.iso.datetime(),
  expires_at: z.iso.datetime(),
  status: z.literal('active'),
  created_at: z.iso.datetime(),
  version: DatabaseIntegerSchema,
});

export type MemberInvitationDraft = z.infer<typeof MemberInvitationDraftSchema>;
export type MemberInvitationReceipt = z.infer<typeof MemberInvitationReceiptSchema>;

export function memberInvitationCommand(value: unknown, now = Date.now()): z.infer<typeof MemberInvitationCommandSchema> {
  const draft = MemberInvitationDraftSchema.parse(value);
  return MemberInvitationCommandSchema.parse({
    label: draft.label,
    maxUses: draft.maxUses,
    expiresAt: new Date(now + draft.validityDays * 86_400_000).toISOString(),
  });
}
