import { createHash } from 'node:crypto';
import type { Scope, ScopeGrant } from '@shop/authz';
import { isOperationTarget, OperationCatalog } from '@shop/contract';
import type { Telemetry } from '@shop/telemetry';
import type { DatabasePool } from '../database/Pool';
import { DomainError } from '../error/DomainError';
import type { Actor } from './AccessContext';
import type { AuthorizationResolution, AuthorizationResolver, AuthorizationRole } from './AuthorizationSnapshot';

interface AuthorizationRow {
  readonly actor_id: string;
  readonly session_id: string;
  readonly membership_id: string;
  readonly session_credential_version: number;
  readonly session_access_version: number;
  readonly session_target: Actor['target'];
  readonly assurance_level: number;
  readonly assurance_verified_at: Date | null;
  readonly membership_active: boolean | null;
  readonly snapshot_access_version: number | null;
  readonly snapshot_credential_version: number | null;
  readonly organization_id: string | null;
  readonly snapshot_target: Actor['target'] | null;
  readonly role_assignments: AuthorizationRole[] | null;
  readonly permission_allows: string[] | null;
  readonly permission_denies: string[] | null;
  readonly scopes: ScopeGrant[] | null;
  readonly resource_scope: Scope | null;
  readonly operation_ids: string[] | null;
  readonly capability_version: number | null;
}

export class PgAuthorizationResolver implements AuthorizationResolver {
  constructor(
    private readonly database: DatabasePool,
    private readonly telemetry: Telemetry
  ) {}

  async resolve(headers: Readonly<Record<string, string>>, operation: string, options: Readonly<{ resource?: string; deadline: number; signal: AbortSignal }>): Promise<AuthorizationResolution> {
    available(options);
    const started = performance.now();
    const trace = headers['x-trace-id'] ?? headers['x-request-id'] ?? `authorization:${operation}`;
    let result = 'failure';
    let membership = 'unresolved';
    try {
      const target = requestedTarget(headers);
      const token = sessionToken(headers, target);
      if (token === null) throw new DomainError('AUTHENTICATION_REQUIRED');
      const definition = OperationCatalog.get(operation);
      const response = await this.database.query<AuthorizationRow>(
        `select session.actor_id,session.session_id,session.membership_id,
        session.credential_version session_credential_version,session.access_version session_access_version,
        session.target session_target,session.assurance_level,session.assurance_verified_at,
        snapshot.membership_active,snapshot.access_version snapshot_access_version,
        snapshot.credential_version snapshot_credential_version,snapshot.organization_id,
        snapshot.target snapshot_target,snapshot.role_assignments,snapshot.permission_allows,
        snapshot.permission_denies,snapshot.scopes,snapshot.resource_scope,snapshot.operation_ids,snapshot.capability_version
        from identity.resolve_session($1) session
        left join lateral access.authorization_snapshot(session.membership_id,session.target,$2,$3) snapshot
          on session.target=any($5::text[])
        where($4::text is null or session.target=$4)`,
        [createHash('sha256').update(token).digest('hex'), operation, options.resource ?? null, target, definition.targets]
      );
      available(options);
      const row = response.rows[0];
      if (!row) throw new DomainError('AUTHENTICATION_REQUIRED');
      membership = row.membership_id;
      const actor = actorOf(row);
      if (row.membership_active === null) return Object.freeze({ actor, snapshot: null });
      const snapshot = snapshotOf(row);
      result = 'success';
      return Object.freeze({ actor, snapshot });
    } finally {
      this.telemetry.metrics.duration('access_authorization_snapshot_duration_ms', performance.now() - started, {
        requestId: trace,
        traceId: trace,
        module: 'access',
        operation,
        membershipId: membership,
        result,
      });
    }
  }
}

function actorOf(row: AuthorizationRow): Actor {
  return Object.freeze({
    id: row.actor_id,
    session: row.session_id,
    membership: row.membership_id,
    credentialVersion: Number(row.session_credential_version),
    accessVersion: Number(row.session_access_version),
    target: row.session_target,
    assurance: Object.freeze({ level: Number(row.assurance_level), ...(row.assurance_verified_at === null ? {} : { verified: row.assurance_verified_at }) }),
  });
}

function snapshotOf(row: AuthorizationRow) {
  if (
    row.snapshot_access_version === null ||
    row.snapshot_credential_version === null ||
    row.organization_id === null ||
    row.snapshot_target === null ||
    row.role_assignments === null ||
    row.permission_allows === null ||
    row.permission_denies === null ||
    row.scopes === null ||
    row.resource_scope === null ||
    row.operation_ids === null ||
    row.capability_version === null
  ) {
    throw new DomainError('MEMBERSHIP_INACTIVE');
  }
  return Object.freeze({
    membership: Object.freeze({
      id: row.membership_id,
      active: row.membership_active === true,
      accessVersion: Number(row.snapshot_access_version),
      permissions: Object.freeze({ allows: new Set(row.permission_allows), denies: new Set(row.permission_denies) }),
      scopes: Object.freeze(row.scopes.map((scope) => Object.freeze({ ...scope, scope: Object.freeze(scope.scope) }))),
    }),
    credentialVersion: Number(row.snapshot_credential_version),
    organization: row.organization_id,
    target: row.snapshot_target,
    roles: Object.freeze(row.role_assignments.map((role) => Object.freeze(role))),
    scope: Object.freeze(row.resource_scope),
    capabilities: new Set(row.operation_ids),
    capabilityVersion: Number(row.capability_version),
  });
}

function requestedTarget(headers: Readonly<Record<string, string>>): Actor['target'] | null {
  const target = headers['x-client-target'];
  if (target === undefined) return null;
  if (!isOperationTarget(target)) throw new Error('AUTH_TARGET_INVALID');
  return target;
}

function sessionToken(headers: Readonly<Record<string, string>>, target: Actor['target'] | null): string | null {
  const authorization = /^Bearer ([A-Za-z0-9._~-]{32,2048})$/.exec(headers.authorization ?? '')?.[1];
  if (authorization !== undefined) return authorization;
  if (target === null) return null;
  const name = `__Host-${target}-session`;
  for (const part of headers.cookie?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

function available(options: Readonly<{ deadline: number; signal: AbortSignal }>): void {
  if (options.signal.aborted) throw options.signal.reason ?? new Error('AUTHORIZATION_ABORTED');
  if (!Number.isFinite(options.deadline) || options.deadline <= Date.now()) throw new Error('DEADLINE_EXCEEDED');
}
