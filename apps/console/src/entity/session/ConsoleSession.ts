import { SCOPE_KINDS, type ConsoleScopeKind, type ScopeKind } from '@shop/authz';
import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { NavigationNodeSchema, NavigationTreeSchema, type NavigationNode } from '../../shared/navigation/NavigationContract';

export const ScopeSchema = z.object({
  kind: z.enum(SCOPE_KINDS),
  id: z.string().min(1),
  tenant: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  path: z.array(z.object({ kind: z.enum(SCOPE_KINDS), id: z.string().min(1) })).optional(),
});

export { NavigationNodeSchema, NavigationTreeSchema };
export type ConsoleNavigationNode = NavigationNode;

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
  csrf: z.string().min(16).optional(),
  target: z.string().min(1),
  syncedAt: z.string().min(1),
});

export const ProfileSchema = z.object({
  display_name: z.string().min(1),
  employee_no: z.string().nullable(),
});

export const ScopePageSchema = z.object({
  items: z.array(ScopeSchema),
  count: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).optional(),
});

export type ConsoleScope = Omit<z.infer<typeof ScopeSchema>, 'kind'> & Readonly<{ kind: ConsoleScopeKind }>;
export type ConsoleSession = z.infer<typeof SessionSchema>;
export type ConsoleProfile = z.infer<typeof ProfileSchema>;

export interface ConsoleContext {
  readonly session: ConsoleSession;
  readonly profile: ConsoleProfile;
  readonly scopes: readonly ConsoleScope[];
  readonly scope: ConsoleScope;
  readonly navigation?: z.infer<typeof NavigationTreeSchema>;
}

export function uniqueScopes(scopes: readonly ConsoleScope[]): readonly ConsoleScope[] {
  const unique = [...new Map(scopes.map((scope) => [`${scope.kind}:${scope.id}`, scope] as const)).values()];
  unique.sort((left, right) => scopeRank(left.kind) - scopeRank(right.kind) || (left.name ?? left.id).localeCompare(right.name ?? right.id));
  return Object.freeze(unique);
}

function scopeRank(kind: ScopeKind): number {
  return SCOPE_KINDS.indexOf(kind);
}
