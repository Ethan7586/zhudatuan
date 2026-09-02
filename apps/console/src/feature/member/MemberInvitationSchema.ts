import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

export const MemberInvitationDraftSchema = z.strictObject({
  label: z.string().trim().min(2).max(80),
  destination: z.string().trim().regex(/^1[3-9]\d{9}$/),
  maxUses: z.coerce.number().int().min(1).max(1),
  validityDays: z.coerce.number().int().min(1).max(90),
  tenantId: z.string().trim().min(1).max(255).optional(),
});

export const MemberInvitationCommandSchema = z.strictObject({
  label: z.string().trim().min(2).max(80),
  destination: z.string().regex(/^1[3-9]\d{9}$/),
  targetClient: z.literal('operator'),
  maxUses: z.literal(1),
  expiresAt: z.iso.datetime(),
  tenantId: z.string().min(1).max(255).optional(),
});

export const MemberInvitationReceiptSchema = z.strictObject({
  id: z.string().min(1),
  code: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  label: z.string().min(2).max(80),
  target: z.literal('console'),
  governanceLevel: z.enum(['administrator', 'senior_administrator']).optional(),
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
    destination: draft.destination,
    targetClient: 'operator',
    maxUses: draft.maxUses,
    expiresAt: new Date(now + draft.validityDays * 86_400_000).toISOString(),
    ...(draft.tenantId === undefined ? {} : { tenantId: draft.tenantId }),
  });
}
