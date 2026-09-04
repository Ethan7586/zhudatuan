import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

export const MemberRegistrationResetDraftSchema = z.strictObject({
  reason: z.string().trim().min(4).max(500),
  understood: z.preprocess((value) => value === true || value === 'on', z.literal(true)),
  confirmation: z.literal('重置'),
  ownerPassword: z.string().min(1).max(128),
});

export const MemberPasswordVerificationReceiptSchema = z.strictObject({
  verified: z.literal(true),
  verifiedAt: z.iso.datetime(),
});

export const MemberRegistrationResetReceiptSchema = z.strictObject({
  principal_id: z.string().min(1),
  status: z.literal('reset'),
  login_identity_released: z.literal(true),
  history_retained: z.literal(true),
  version: DatabaseIntegerSchema,
});

export type MemberRegistrationResetDraft = z.infer<typeof MemberRegistrationResetDraftSchema>;
export type MemberRegistrationResetReceipt = z.infer<typeof MemberRegistrationResetReceiptSchema>;
