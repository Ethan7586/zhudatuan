import type { MembershipAccess, Scope } from '@shop/authz';
import type { MallContext } from '../../modules/mall';

export type GovernanceLevel = 'owner' | 'senior_administrator' | 'administrator' | 'member';

export interface GovernanceScope {
  readonly kind: Scope['kind'];
  readonly semanticId: string;
  readonly storageId: string;
  readonly organizationId?: string;
}

export interface GovernanceContext {
  readonly governanceLevel: GovernanceLevel;
  readonly isExactOwner: boolean;
  readonly actorMembershipId: string;
  readonly actorPrincipalId: string;
  readonly organizationId: string;
  readonly ownerMembershipId?: string;
  readonly scope: GovernanceScope;
  readonly resolvedAt: Date;
}

export interface Actor {
  readonly id: string;
  readonly session: string;
  readonly membership: string;
  readonly credentialVersion: number;
  readonly accessVersion: number;
  readonly target: 'console' | 'storefront' | 'store' | 'supplier';
  readonly assurance: Readonly<{ level: number; verified?: Date }>;
}

export interface AccessContext {
  readonly actor: Actor;
  readonly membership: MembershipAccess;
  readonly scope: Scope;
  /** Present on every context produced by AccessPipeline. Optional only for legacy synthetic fixtures. */
  readonly governance?: GovernanceContext;
  readonly mallContext?: MallContext;
  readonly mall_id?: string;
  readonly accessVersion: number;
  readonly capabilities: readonly string[];
  readonly assurance: Actor['assurance'];
  readonly trace: string;
}

export function requireGovernanceContext(access: AccessContext): GovernanceContext {
  if (!access.governance) throw new Error('GOVERNANCE_CONTEXT_MISSING');
  return access.governance;
}
