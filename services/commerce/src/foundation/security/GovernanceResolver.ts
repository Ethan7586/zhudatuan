import type { MembershipAccess, Scope } from '@shop/authz';
import type { DatabasePool } from '../persistence/Pool';
import type { Actor, GovernanceContext, GovernanceLevel } from './AccessContext';

export interface GovernanceResolver {
  resolve(actor: Actor, membership: MembershipAccess, scope: Scope): Promise<GovernanceContext>;
}

interface GovernanceRow {
  readonly governance_level: GovernanceLevel;
  readonly is_exact_owner: boolean;
  readonly actor_membership_id: string;
  readonly actor_principal_id: string;
  readonly organization_id: string;
  readonly owner_membership_id: string | null;
  readonly scope_kind: Scope['kind'];
  readonly scope_semantic_id: string;
  readonly scope_storage_id: string;
  readonly scope_organization_id: string | null;
  readonly resolved_at: Date;
}

export class PgGovernanceResolver implements GovernanceResolver {
  constructor(private readonly pool: DatabasePool) {}

  async resolve(actor: Actor, membership: MembershipAccess, scope: Scope): Promise<GovernanceContext> {
    const result = await this.pool.query<GovernanceRow>(
      `select governance_level,is_exact_owner,actor_membership_id,actor_principal_id,organization_id,
        owner_membership_id,scope_kind,scope_semantic_id,scope_storage_id,scope_organization_id,resolved_at
      from access.resolve_governance($1,$2,$3,$4)`,
      [membership.id, actor.id, scope.kind, scope.id]
    );
    const row = result.rows[0];
    if (!row) throw new Error('GOVERNANCE_CONTEXT_UNRESOLVED');
    if (row.actor_membership_id !== membership.id || row.actor_principal_id !== actor.id) throw new Error('GOVERNANCE_CONTEXT_MISMATCH');
    if (!(row.resolved_at instanceof Date) || !Number.isFinite(row.resolved_at.getTime())) throw new Error('GOVERNANCE_CONTEXT_TIME_INVALID');
    return Object.freeze({
      governanceLevel: row.governance_level,
      isExactOwner: row.is_exact_owner,
      actorMembershipId: row.actor_membership_id,
      actorPrincipalId: row.actor_principal_id,
      organizationId: row.organization_id,
      ...(row.owner_membership_id === null ? {} : { ownerMembershipId: row.owner_membership_id }),
      scope: Object.freeze({
        kind: row.scope_kind,
        semanticId: row.scope_semantic_id,
        storageId: row.scope_storage_id,
        ...(row.scope_organization_id === null ? {} : { organizationId: row.scope_organization_id }),
      }),
      resolvedAt: row.resolved_at,
    });
  }
}
