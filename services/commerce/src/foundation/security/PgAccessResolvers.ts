import { createHash } from 'node:crypto';
import type { MembershipAccess, Scope, ScopeGrant } from '@shop/authz';
import type { DatabasePool } from '../persistence/Pool';
import type { AccessVersionResolver, CapabilityResolver, MembershipResolver } from './AccessPipeline';
import type { Actor } from './AccessContext';
import type { ScopeResolver } from './ScopeResolver';
import type { SessionResolver } from './SessionResolver';

interface SessionRow {
  readonly actor_id: string;
  readonly session_id: string;
  readonly membership_id: string;
  readonly credential_version: number;
  readonly access_version: number;
  readonly target: Actor['target'];
  readonly assurance_level: number;
  readonly assurance_verified_at: Date | null;
}
interface MembershipRow { readonly id: string; readonly active: boolean; readonly access_version: number; readonly denies: string[]; readonly grants: ScopeGrant[] }
interface ScopeRow { readonly scope: Scope }

export class PgSessionResolver implements SessionResolver {
  constructor(private readonly pool: DatabasePool) {}

  async resolve(headers: Readonly<Record<string, string>>): Promise<Actor> {
    const token = bearer(headers.authorization) ?? cookie(headers.cookie, 'shop_session');
    if (!token) throw new Error('AUTHENTICATION_REQUIRED');
    const result = await this.pool.query<SessionRow>('select actor_id,session_id,membership_id,credential_version,access_version,target,assurance_level,assurance_verified_at from identity.resolve_session($1)', [createHash('sha256').update(token).digest('hex')]);
    const row = result.rows[0];
    if (!row) throw new Error('AUTHENTICATION_REQUIRED');
    return {
      id: row.actor_id,
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
  async resolve(membership: string): Promise<MembershipAccess> {
    const result = await this.pool.query<MembershipRow>('select id,active,access_version,denies,grants from access.resolve_membership($1)', [membership]);
    const row = result.rows[0];
    if (!row) throw new Error('MEMBERSHIP_INACTIVE');
    return { id: row.id, active: row.active, accessVersion: row.access_version, denies: row.denies, grants: row.grants };
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
  async resolve(actor: Actor, operation: string, resource?: string): Promise<Scope> {
    const result = await this.pool.query<ScopeRow>('select scope from access.resolve_scope($1,$2,$3)', [actor.membership, operation, resource ?? null]);
    const row = result.rows[0];
    if (!row) throw new Error('SCOPE_DENIED');
    return row.scope;
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
