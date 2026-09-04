import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

export const OwnerIdentitySchema = z.object({
  membership: z.string().min(1),
  member: z.string().min(1),
  principal: z.string().min(1),
  displayName: z.string().min(1),
});

export const OwnerCandidateSchema = OwnerIdentitySchema.extend({
  roles: z.array(z.string().min(1)),
  accessVersion: DatabaseIntegerSchema,
  mobileReady: z.boolean(),
});

export const FormerOwnerRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: DatabaseIntegerSchema,
});

export const OwnerTransferSchema = z.object({
  id: z.string().min(1),
  state: z.enum(['pending_acceptance', 'accepted', 'cancelled', 'expired']),
  sourceMembership: z.string().min(1),
  targetMembership: z.string().min(1),
  targetMember: z.string().min(1),
  targetPrincipal: z.string().min(1),
  targetDisplayName: z.string().min(1),
  formerOwnerMode: z.enum(['retain_admin', 'remove_admin']),
  formerOwnerRole: z.string().min(1).nullable(),
  coolingUntil: z.string().min(1),
  expiresAt: z.string().min(1),
  version: DatabaseIntegerSchema,
});

export const OwnershipStateSchema = z.object({
  state: z.enum(['bootstrap_pending', 'active']),
  version: DatabaseIntegerSchema,
  mobileReady: z.boolean(),
  owner: OwnerIdentitySchema.nullable(),
  candidates: z.array(OwnerCandidateSchema),
  formerOwnerRoles: z.array(FormerOwnerRoleSchema),
  pending: OwnerTransferSchema.nullable(),
});

export const OwnerTransferPreviewSchema = z.object({
  proof: z.string().min(16),
  proofExpiresAt: z.string().min(1),
  ownershipVersion: DatabaseIntegerSchema,
  targetAccessVersion: DatabaseIntegerSchema,
  sourceMembership: z.string().min(1),
  targetMembership: z.string().min(1),
  formerOwnerMode: z.enum(['retain_admin', 'remove_admin']),
  formerOwnerRole: z.string().min(1).nullable(),
  formerOwnerRoleVersion: z.nullable(DatabaseIntegerSchema),
});

export const OwnerTransferAcceptPreviewSchema = OwnerTransferPreviewSchema.extend({
  transferVersion: DatabaseIntegerSchema,
});

export const OwnerTransferAcceptedSchema = z.object({
  state: z.literal('active'),
  version: DatabaseIntegerSchema,
  owner: OwnerIdentitySchema,
  transfer: OwnerTransferSchema.extend({ state: z.literal('accepted') }),
});

export const StepUpChallengeSchema = z.object({
  id: z.string().min(1),
  purpose: z.literal('stepup'),
  expires_at: z.string().min(1),
});

export const StepUpCompletionSchema = z.object({
  id: z.string().min(1),
  assurance_level: z.literal(3),
});

export const PhoneChangeChallengeSchema = z.object({
  id: z.string().min(1),
  purpose: z.literal('phone_change'),
  expires_at: z.string().min(1),
});

export const MobileManageReceiptSchema = z.object({
  id: z.string().min(1),
  version: DatabaseIntegerSchema,
});

export const PasswordVerificationSchema = z.object({
  verified: z.literal(true),
  verifiedAt: z.string().min(1),
});

export type OwnershipState = z.infer<typeof OwnershipStateSchema>;
export type OwnerCandidate = z.infer<typeof OwnerCandidateSchema>;
export type OwnerTransfer = z.infer<typeof OwnerTransferSchema>;
export type OwnerTransferPreview = z.infer<typeof OwnerTransferPreviewSchema>;
export type OwnerTransferAcceptPreview = z.infer<typeof OwnerTransferAcceptPreviewSchema>;
export type FormerOwnerMode = OwnerTransferPreview['formerOwnerMode'];
