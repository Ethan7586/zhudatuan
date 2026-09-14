import { createHash } from 'node:crypto';
import type { MembershipAccess, Scope, ScopeGrant } from '@shop/authz';
import type { NodeProfile, SignedLevel } from '@shop/config/sfl-node-kernel';
import type { DatabasePool } from '../persistence/Pool';
import { SingleFlight } from '../application/SingleFlight';
import type { AccessVersionResolver, CapabilityResolver, MembershipResolver, MembershipSnapshot } from './AccessPipeline';
import {
  bindScopeNodeContext,
  requireActorNodeContext,
  requireMembershipConsumptionContext,
  type Actor,
  type MembershipConsumptionContext,
  type NodeContextActor,
} from './AccessContext';
import type { ScopeResolver } from './ScopeResolver';
import { sessionNodeContext, type RuntimeSessionResolver } from './SessionResolver';
import { requestSessionCookie } from './AuthSessionCookies';

interface SessionRow {
  readonly actor_id: string;
  readonly account_id: string;
  readonly realm_id: string;
  readonly session_id: string;
  readonly membership_id: string;
  readonly credential_version: number;
  readonly access_version: number;
  readonly target: Actor['target'];
  readonly membership_client: NonNullable<Actor['membershipClient']>;
  readonly governance_organization_id: string;
  readonly assurance_level: number;
  readonly assurance_verified_at: Date | null;
  readonly entry_realm_id: string;
  readonly line_id: string;
  readonly node_id: string;
  readonly parent_node_id: string | null;
  readonly signed_level: SignedLevel;
  readonly node_profile: NodeProfile;
  readonly mall_id: string | null;
  readonly host_sovereign_node_id: string;
}
interface MembershipRow {
  readonly id: string;
  readonly active: boolean;
  readonly access_version: number;
  readonly denies: string[];
  readonly grants: ScopeGrant[];
  readonly evaluated_at: Date;
  readonly capabilities?: string[];
}
interface ScopeRow { readonly scope: Scope }

export class PgSessionResolver implements RuntimeSessionResolver {
  private readonly active = new SingleFlight<NodeContextActor>();
  constructor(private readonly pool: DatabasePool) {}

  async resolve(headers: Readonly<Record<string, string>>): Promise<NodeContextActor> {
    const token = bearer(headers.authorization) ?? requestSessionCookie(headers);
    if (!token) throw new Error('AUTHENTICATION_REQUIRED');
    const nodeContext = sessionNodeContext(headers);
    const parameters = [createHash('sha256').update(token).digest('hex'), nodeContext.host];
    return this.active.run(JSON.stringify(parameters), async () => {
      const result = await this.pool.query<SessionRow>('select actor_id,account_id,realm_id,session_id,membership_id,credential_version,access_version,target,membership_client,governance_organization_id,assurance_level,assurance_verified_at,entry_realm_id,line_id,node_id,parent_node_id,signed_level,node_profile,mall_id,host_sovereign_node_id from identity.resolve_session($1,$2)', parameters);
      const row = result.rows[0];
      if (!row) throw new Error('AUTHENTICATION_REQUIRED');
      if (!row.account_id || !row.realm_id) throw new Error('AUTH_REALM_CONTEXT_MISSING');
      if (!row.governance_organization_id || (row.target === 'console' ? row.membership_client !== 'operator' : row.membership_client !== row.target)) {
        throw new Error('AUTH_MEMBERSHIP_CONTEXT_MISMATCH');
      }
      if (row.entry_realm_id !== nodeContext.realm.ref) throw new Error('AUTH_REALM_MISMATCH');
      const activeNode = Object.freeze({
        line_id: row.line_id,
        node_id: row.node_id,
        parent_node_id: row.parent_node_id,
        signed_level: row.signed_level,
        node_profile: row.node_profile,
        mall_id: row.mall_id,
        host_node_id: row.node_id === row.host_sovereign_node_id ? null : row.host_sovereign_node_id,
      });
      const activeNodeContext = Object.freeze({
        ...nodeContext,
        ...activeNode,
        realm: Object.freeze({ ...nodeContext.realm, ref: row.realm_id }),
      });
      return Object.freeze({
        id: row.actor_id,
        account: row.account_id,
        realm: row.realm_id,
        membershipClient: row.membership_client,
        governanceOrganization: row.governance_organization_id,
        nodeContext: activeNodeContext,
        session: row.session_id,
        membership: row.membership_id,
        credentialVersion: row.credential_version,
        accessVersion: row.access_version,
        target: row.target,
        assurance: Object.freeze({ level: row.assurance_level, ...(row.assurance_verified_at === null ? {} : { verified: row.assurance_verified_at }) }),
      });
    });
  }
}

export class PgMembershipResolver implements MembershipResolver {
  private readonly active = new SingleFlight<MembershipSnapshot>();
  constructor(private readonly pool: DatabasePool) {}
  async resolve(membership: string, context?: MembershipConsumptionContext): Promise<MembershipSnapshot> {
    if (!context) throw new Error('AUTH_MEMBERSHIP_CONTEXT_MISSING');
    const parameters = [membership, context.realmId, context.client, context.organizationId] as const;
    return this.active.run(JSON.stringify(parameters), async () => {
      const result = await this.pool.query<MembershipRow>(
        `with snapshot as materialized(select clock_timestamp() evaluated_at),
        resolved as materialized(
          select membership.* from snapshot
          cross join lateral access.resolve_session_membership($1,$2,$3,$4) membership
          where snapshot.evaluated_at is not null
        )
        select resolved.id,resolved.active,resolved.access_version,resolved.denies,resolved.grants,snapshot.evaluated_at,
          array(select operation_id from capability.session_membership_operations($1,$2,$3,$4)
            order by operation_id) capabilities
        from resolved cross join snapshot`, parameters
      );
      const row = result.rows[0];
      if (!row) throw new Error('MEMBERSHIP_INACTIVE');
      if (!(row.evaluated_at instanceof Date) || !Number.isFinite(row.evaluated_at.getTime())) throw new Error('AUTHORIZATION_TIME_INVALID');
      return Object.freeze({
        access: Object.freeze({ id: row.id, active: row.active, accessVersion: row.access_version, denies: row.denies, grants: row.grants }),
        evaluatedAt: row.evaluated_at,
        ...(row.capabilities === undefined ? {} : { capabilities: Object.freeze([...row.capabilities]) }),
      });
    });
  }
}

export class PgAccessVersionResolver implements AccessVersionResolver {
  constructor(private readonly pool: DatabasePool) {}
  async resolve(membership: string, context?: MembershipConsumptionContext): Promise<number> {
    if (!context) throw new Error('AUTH_MEMBERSHIP_CONTEXT_MISSING');
    const result = await this.pool.query<{ access_version: number | null }>('select access.session_membership_version($1,$2,$3,$4) as access_version',
      [membership, context.realmId, context.client, context.organizationId]);
    const version = result.rows[0]?.access_version;
    if (version === undefined || version === null) throw new Error('MEMBERSHIP_INACTIVE');
    return version;
  }
}

export class PgScopeResolver implements ScopeResolver {
  private readonly active = new SingleFlight<Scope>();
  constructor(private readonly pool: DatabasePool) {}
  async resolve(actor: Actor, operation: string, resource?: string, scopeHint?: string): Promise<Scope> {
    const context = requireMembershipConsumptionContext(actor);
    const parameters = [actor.membership, context.realmId, context.client, context.organizationId,
      operation, resource ?? null, scopeHint ?? null] as const;
    const flightKey = JSON.stringify([...parameters, actor.nodeContext?.node_id ?? null, actor.nodeContext?.host ?? null]);
    return this.active.run(flightKey, async () => {
      const result = await this.pool.query<ScopeRow>('select scope from access.resolve_session_scope($1,$2,$3,$4,$5,$6,$7)', parameters);
      const row = result.rows[0];
      if (!row?.scope) throw new Error('SCOPE_DENIED');
      return actor.nodeContext === undefined ? row.scope : bindScopeNodeContext(row.scope, requireActorNodeContext(actor));
    });
  }
}

export class PgCapabilityResolver implements CapabilityResolver {
  constructor(private readonly pool: DatabasePool) {}
  async resolve(membership: string, context?: MembershipConsumptionContext): Promise<readonly string[]> {
    if (!context) throw new Error('AUTH_MEMBERSHIP_CONTEXT_MISSING');
    const result = await this.pool.query<{ operation_id: string }>('select operation_id from capability.session_membership_operations($1,$2,$3,$4)',
      [membership, context.realmId, context.client, context.organizationId]);
    return Object.freeze(result.rows.map((row) => row.operation_id));
  }
}

function bearer(value: string | undefined): string | null {
  const match = /^Bearer ([A-Za-z0-9._~-]{32,2048})$/.exec(value ?? '');
  return match?.[1] ?? null;
}
