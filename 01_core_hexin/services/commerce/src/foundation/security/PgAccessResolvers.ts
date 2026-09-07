import { createHash } from 'node:crypto';
import type { MembershipAccess, Scope, ScopeGrant } from '@shop/authz';
import type { DatabasePool } from '../persistence/Pool';
import type { AccessVersionResolver, CapabilityResolver, MembershipResolver, MembershipSnapshot } from './AccessPipeline';
import {
  bindScopeNodeContext,
  requireActorNodeContext,
  type Actor,
  type AuthenticatedActor,
} from './AccessContext';
import type { ScopeResolver } from './ScopeResolver';
import { sessionNodeContext, type RuntimeSessionResolver } from './SessionResolver';

interface SessionRow {
  readonly actor_id: string;
  readonly account_id: string;
  readonly realm_id: string;
  readonly session_id: string;
  readonly membership_id: string;
  readonly credential_version: number;
  readonly access_version: number;
  readonly target: Actor['target'];
  readonly assurance_level: number;
  readonly assurance_verified_at: Date | null;
}
interface MembershipRow {
  readonly id: string;
  readonly active: boolean;
  readonly access_version: number;
  readonly denies: string[];
  readonly grants: ScopeGrant[];
  readonly evaluated_at: Date;
}
interface ScopeRow { readonly scope: Scope }

export class PgSessionResolver implements RuntimeSessionResolver {
  constructor(private readonly pool: DatabasePool) {}

  async resolve(headers: Readonly<Record<string, string>>): Promise<AuthenticatedActor> {
    const token = bearer(headers.authorization) ?? cookie(headers.cookie, 'shop_session');
    if (!token) throw new Error('AUTHENTICATION_REQUIRED');
    const nodeContext = sessionNodeContext(headers);
    const result = await this.pool.query<SessionRow>('select actor_id,account_id,realm_id,session_id,membership_id,credential_version,access_version,target,assurance_level,assurance_verified_at from identity.resolve_session($1,$2)',
      [createHash('sha256').update(token).digest('hex'), nodeContext.host]);
    const row = result.rows[0];
    if (!row) throw new Error('AUTHENTICATION_REQUIRED');
    if (row.realm_id !== nodeContext.realm.ref) throw new Error('AUTH_REALM_MISMATCH');
    return {
      id: row.actor_id,
      account: row.account_id,
      realm: row.realm_id,
      nodeContext,
      session: row.session_id,
      membership: row.membership_id,
      credentialVersion: row.credential_version,
      accessVersion: row.access_version,
      target: row.target,
      assurance: { level: row.assurance_level, ...(row.assurance_verified_at === null ? {} : { verified: row.assurance_verified_at }) },
    };
  }
}

export class PgMembershipResolver implements MembershipResolver {
  constructor(private readonly pool: DatabasePool) {}
  async resolve(membership: string): Promise<MembershipSnapshot> {
    const result = await this.pool.query<MembershipRow>(
      `with snapshot as materialized(select clock_timestamp() evaluated_at),
      resolved as materialized(
        select membership.* from snapshot
        cross join lateral access.resolve_membership($1) membership
        where snapshot.evaluated_at is not null
      )
      select resolved.id,resolved.active,resolved.access_version,resolved.denies,resolved.grants,snapshot.evaluated_at
      from resolved cross join snapshot`,
      [membership]
    );
    const row = result.rows[0];
    if (!row) throw new Error('MEMBERSHIP_INACTIVE');
    if (!(row.evaluated_at instanceof Date) || !Number.isFinite(row.evaluated_at.getTime())) throw new Error('AUTHORIZATION_TIME_INVALID');
    return Object.freeze({
      access: Object.freeze({ id: row.id, active: row.active, accessVersion: row.access_version, denies: row.denies, grants: row.grants }),
      evaluatedAt: row.evaluated_at,
    });
  }
}

export class PgAccessVersionResolver implements AccessVersionResolver {
  constructor(private readonly pool: DatabasePool) {}
  async resolve(membership: string): Promise<number> {
    const result = await this.pool.query<{ access_version: number | null }>('select access.membership_version($1) as access_version', [membership]);
    const version = result.rows[0]?.access_version;
    if (version === undefined || version === null) throw new Error('MEMBERSHIP_INACTIVE');
    return version;
  }
}

export class PgScopeResolver implements ScopeResolver {
  constructor(private readonly pool: DatabasePool) {}
  async resolve(actor: Actor, operation: string, resource?: string, scopeHint?: string): Promise<Scope> {
    const result = await this.pool.query<ScopeRow>('select scope from access.resolve_scope($1,$2,$3,$4)',
      [actor.membership, operation, resource ?? null, scopeHint ?? null]);
    const row = result.rows[0];
    if (!row?.scope) throw new Error('SCOPE_DENIED');
    return actor.nodeContext === undefined ? row.scope : bindScopeNodeContext(row.scope, requireActorNodeContext(actor));
  }
}

export class PgCapabilityResolver implements CapabilityResolver {
  constructor(private readonly pool: DatabasePool) {}
  async resolve(membership: string): Promise<readonly string[]> {
    const result = await this.pool.query<{ operation_id: string }>('select operation_id from capability.membership_operations($1)', [membership]);
    return Object.freeze(result.rows.map((row) => row.operation_id));
  }
}

function bearer(value: string | undefined): string | null {
  const match = /^Bearer ([A-Za-z0-9._~-]{32,2048})$/.exec(value ?? '');
  return match?.[1] ?? null;
}

function cookie(value: string | undefined, name: string): string | null {
  for (const part of value?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}
