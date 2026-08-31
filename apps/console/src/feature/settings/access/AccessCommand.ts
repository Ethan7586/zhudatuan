import type { OperationId } from '@shop/contract';
import { createFetchAccessOverridesManage, createFetchAccessRolesManage, createFetchAccessScopesManage } from '@shop/sdk/access';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand } from '../../../shared/api/Client';
import { appConfig } from '../../../shared/config/AppConfig';
import type { AccessMembership } from './AccessSchema';

const rolesManage = createFetchAccessRolesManage(appConfig.apiBaseUrl);
const overridesManage = createFetchAccessOverridesManage(appConfig.apiBaseUrl);
const scopesManage = createFetchAccessScopesManage(appConfig.apiBaseUrl);
export type AccessRole = AccessMembership['roles'][number];

export type AccessChange =
  | Readonly<{ kind: 'role'; membership: AccessMembership; role: AccessRole; name: string; allows: readonly string[]; denies: readonly string[]; proof: string }>
  | Readonly<{ kind: 'override'; membership: AccessMembership; action: 'set' | 'revoke'; permission: string; effect: 'allow' | 'deny'; expiresAt?: string; reason: string; proof: string }>
  | Readonly<{ kind: 'scope'; membership: AccessMembership; scopeKind: string; scope: string; effect: 'allow' | 'deny'; expiresAt?: string; proof: string }>;
type WithoutProof<T> = T extends unknown ? Omit<T, 'proof'> : never;
export type AccessDraft = WithoutProof<AccessChange>;

export interface AccessEnvelope {
  readonly operation: OperationId;
  readonly input: Readonly<{ path?: Readonly<Record<string, string>>; body: Readonly<Record<string, unknown>> }>;
  readonly expectedVersion: number;
}

export async function executeAccessChange(context: ConsoleContext, change: AccessChange, signal?: AbortSignal) {
  if (context.session.assurance.level < 3) throw new Error('STEPUP_REQUIRED');
  if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
  const envelope = accessEnvelope(change);
  const request = consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    expectedVersion: envelope.expectedVersion,
    proof: change.proof,
    csrfToken: context.session.csrf,
    ...(signal === undefined ? {} : { signal }),
  });
  if (change.kind === 'role') return rolesManage(envelope.input as Parameters<typeof rolesManage>[0], request);
  if (change.kind === 'override') return overridesManage(envelope.input as Parameters<typeof overridesManage>[0], request);
  return scopesManage(envelope.input as Parameters<typeof scopesManage>[0], request);
}

export function accessEnvelope(change: AccessDraft): AccessEnvelope {
  if (change.kind === 'role') {
    return Object.freeze({
      operation: 'access.roles.manage',
      input: Object.freeze({ path: Object.freeze({ roleid: change.role.role }), body: Object.freeze({ name: change.name.trim(), allows: [...change.allows], denies: [...change.denies] }) }),
      expectedVersion: change.role.version,
    });
  }
  if (change.kind === 'override') {
    const body =
      change.action === 'revoke'
        ? { action: 'revoke' as const, targetMembership: change.membership.id, permission: change.permission, reason: change.reason.trim() }
        : { action: 'set' as const, targetMembership: change.membership.id, permission: change.permission, effect: change.effect, ...(change.expiresAt ? { expiresAt: change.expiresAt } : {}), reason: change.reason.trim() };
    return Object.freeze({ operation: 'access.overrides.manage', input: Object.freeze({ body: Object.freeze(body) }), expectedVersion: change.membership.access_version });
  }
  const body = { targetMembership: change.membership.id, kind: change.scopeKind, scope: change.scope.trim(), effect: change.effect, ...(change.expiresAt ? { expiresAt: change.expiresAt } : {}) };
  return Object.freeze({ operation: 'access.scopes.manage', input: Object.freeze({ body: Object.freeze(body) }), expectedVersion: change.membership.access_version });
}
