import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../../shared/schema/PageEnvelope';

export const AccessMembershipSchema = z
  .object({
    id: z.string().min(1),
    client: z.string().min(1),
    status: z.string().min(1),
    access_version: DatabaseIntegerSchema,
    roles: z.array(z.object({ role: z.string().min(1), name: z.string().min(1), kind: z.enum(['custom', 'system', 'owner']), version: DatabaseIntegerSchema, allows: z.array(z.string()), denies: z.array(z.string()) })),
    scopes: z.array(z.object({ id: z.string().min(1), kind: z.string().min(1), scope: z.string().min(1), effect: z.enum(['allow', 'deny']), expires: z.string().nullable() })),
    overrides: z.array(z.object({ permission: z.string().min(1), effect: z.enum(['allow', 'deny']), expires: z.string().nullable() })),
  })
  .strict();
export const AccessPageSchema = pageEnvelope(AccessMembershipSchema);
export type AccessMembership = z.infer<typeof AccessMembershipSchema>;

export const InvitationSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['signin', 'enrollment', 'campaign']),
    target: z.enum(['console', 'storefront']),
    organization_id: z.string().min(1),
    membership_id: z.string().nullable(),
    recipient: z.string().nullable(),
    issuer_membership_id: z.string().min(1),
    issuer_access_version: DatabaseIntegerSchema,
    minimum_assurance: DatabaseIntegerSchema,
    max_uses: DatabaseIntegerSchema,
    use_count: DatabaseIntegerSchema,
    not_before: z.string().min(1),
    expires_at: z.string().min(1),
    status: z.enum(['draft', 'active', 'exhausted', 'revoked', 'expired']),
    reason: z.string(),
    created_at: z.string().min(1),
    revoked_at: z.string().nullable(),
    revoked_by: z.string().nullable(),
    revoke_reason: z.string().nullable(),
    version: DatabaseIntegerSchema,
  })
  .strict();

export const InvitationPageSchema = pageEnvelope(InvitationSchema);
export const InvitationCreatedSchema = InvitationSchema.pick({
  id: true,
  kind: true,
  target: true,
  organization_id: true,
  membership_id: true,
  minimum_assurance: true,
  max_uses: true,
  use_count: true,
  not_before: true,
  expires_at: true,
  status: true,
  reason: true,
  created_at: true,
  version: true,
})
  .extend({ code: z.string().min(1) })
  .strict();
export const InvitationRevokedSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['signin', 'enrollment', 'campaign']),
    target: z.enum(['console', 'storefront']),
    status: z.literal('revoked'),
    revoked_at: z.string().min(1),
    revoked_by: z.string().min(1),
    revoke_reason: z.string().min(1),
    version: DatabaseIntegerSchema,
  })
  .strict();
export type Invitation = z.infer<typeof InvitationSchema>;
export type InvitationCreated = z.infer<typeof InvitationCreatedSchema>;
