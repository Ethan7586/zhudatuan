import { z } from 'zod';
import { ScopeSchema } from '../../entity/session/ConsoleSession';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const AccessScopeSourceSchema = z.enum(['direct', 'inherited', 'l1_owner']);
const AccessEditableScopeSourceSchema = z.enum(['direct', 'inherited']);

export const AccessRoleAssignmentSchema = z.object({
  role: z.string().min(1),
  name: z.string().min(1),
  scope: ScopeSchema,
  scope_source: AccessScopeSourceSchema,
  effective_at: z.string().min(1),
  expires: z.string().nullable(),
});
export const AccessMembershipSchema = z.object({
  id: z.string().min(1), status: z.string().min(1), access_version: DatabaseIntegerSchema,
  member_id: z.string().min(1), display_name: z.string().min(1), employee_no: z.string().nullable(),
  roles: z.array(AccessRoleAssignmentSchema),
  scopes: z.array(z.object({ id: z.string().min(1), kind: ScopeSchema.shape.kind, scope: z.string().min(1),
    effect: z.enum(['allow', 'deny']), expires: z.string().nullable() })),
  denies: z.array(z.string().min(1)),
  effective_permissions: z.array(z.string().min(1)),
}).passthrough();
export const AccessRoleMemberSchema = AccessRoleAssignmentSchema.omit({ role: true, name: true }).extend({
  membership: z.string().min(1), member_id: z.string().min(1), display_name: z.string().min(1),
  employee_no: z.string().nullable(), access_version: DatabaseIntegerSchema,
  scope_source: AccessEditableScopeSourceSchema,
});
export const AccessRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['active', 'disabled']),
  version: DatabaseIntegerSchema,
  permissions: z.array(z.string().min(1)),
  member_count: DatabaseIntegerSchema,
  governance: z.boolean(),
  governance_level: z.enum(['owner', 'senior_administrator', 'administrator']).nullable().optional(),
  editable: z.boolean(),
  members: z.array(AccessRoleMemberSchema).default([]),
  scopes: z.array(z.object({
    scope: ScopeSchema, source: AccessEditableScopeSourceSchema, member_count: DatabaseIntegerSchema,
  })).default([]),
}).passthrough();
export const AccessPageSchema = pageEnvelope(AccessMembershipSchema).extend({ roles: z.array(AccessRoleSchema) });
export const AccessRoleWriteReceiptSchema = AccessRoleSchema.pick({ id: true, name: true, status: true, version: true }).extend({
  affected_memberships: z.array(z.object({ membership: z.string().min(1), access_version: DatabaseIntegerSchema })).default([]),
}).passthrough();
export const AccessRoleAssignmentReceiptSchema = z.object({
  action: z.enum(['assign', 'revoke']), changed: z.boolean(), role: z.string().min(1), membership: z.string().min(1),
  scope: ScopeSchema, scope_source: z.enum(['direct', 'inherited']), access_version: DatabaseIntegerSchema,
});
export const AccessRoleDeleteReceiptSchema = z.object({
  action: z.literal('delete'), deleted: z.literal(true), role: z.string().min(1), name: z.string().min(1),
  affected_memberships: z.array(z.object({ membership: z.string().min(1), access_version: DatabaseIntegerSchema })),
});
export type AccessMembership = z.infer<typeof AccessMembershipSchema>;
export type AccessRole = z.infer<typeof AccessRoleSchema>;
export type AccessRoleMember = z.infer<typeof AccessRoleMemberSchema>;
