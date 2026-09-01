import { SCOPE_KINDS, type ScopeKind } from '@shop/authz';
import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

export const ScopeSchema = z.object({
  kind: z.enum(SCOPE_KINDS),
  id: z.string().min(1),
  tenant: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  path: z.array(z.object({ kind: z.enum(SCOPE_KINDS), id: z.string().min(1) })).optional(),
});

export const SessionSchema = z.object({
  actor: z.string().min(1),
  membership: z.string().min(1),
  scope: ScopeSchema,
  scopes: z.array(ScopeSchema),
  accessVersion: DatabaseIntegerSchema,
  permissions: z.array(z.string().min(1)),
  capabilities: z.array(z.string().min(1)),
  assurance: z.object({
    level: z.number().int().nonnegative(),
    verified: z.string().min(1).optional(),
  }),
  security: z.object({
    hasLocalCredential: z.boolean(),
    phoneMasked: z.string().min(1).nullable(),
    passwordChangedAt: z.string().min(1).nullable(),
  }).optional(),
  csrf: z.string().min(16).optional(),
  target: z.string().min(1),
  syncedAt: z.string().min(1),
});

export const ProfileSchema = z.object({
  id: z.string().min(1).optional(),
  display_name: z.string().min(1),
  status: z.string().min(1).optional(),
  mobile_bound: z.boolean().optional(),
  membership_id: z.string().min(1).optional(),
  organization_id: z.string().min(1).optional(),
  employee_no: z.string().nullable(),
  joined_at: z.string().min(1).nullable().optional(),
  access_version: z.optional(DatabaseIntegerSchema),
});

export const ScopePageSchema = z.object({
  items: z.array(ScopeSchema),
  count: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).optional(),
});

export type ConsoleScope = z.infer<typeof ScopeSchema> & Readonly<{ kind: ScopeKind }>;
export type ConsoleSession = z.infer<typeof SessionSchema>;
export type ConsoleProfile = z.infer<typeof ProfileSchema>;

export interface ConsoleContext {
  readonly session: ConsoleSession;
  readonly profile: ConsoleProfile;
  readonly profileState?: 'ready' | 'unavailable';
  readonly scopes: readonly ConsoleScope[];
  readonly scope: ConsoleScope;
}

export function uniqueScopes(scopes: readonly ConsoleScope[]): readonly ConsoleScope[] {
  const unique = [...new Map(scopes.map((scope) => [`${scope.kind}:${scope.id}`, scope] as const)).values()];
  unique.sort((left, right) => scopeRank(left.kind) - scopeRank(right.kind)
    || (left.name ?? left.id).localeCompare(right.name ?? right.id));
  return Object.freeze(unique);
}

function scopeRank(kind: ScopeKind): number {
  return SCOPE_KINDS.indexOf(kind);
}
