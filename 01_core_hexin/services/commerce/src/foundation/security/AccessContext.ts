import type { MembershipAccess, Scope } from '@shop/authz';
import type { ResolvedNodeContext } from '@shop/config/sfl-node-kernel';
import type { MallContext } from '../../modules/mall';

const requestNodeContexts = new WeakMap<object, ResolvedNodeContext>();
const scopeNodeContexts = new WeakMap<object, ResolvedNodeContext>();

export type GovernanceLevel = 'owner' | 'senior_administrator' | 'administrator' | 'member';
export type MembershipClient = 'storefront' | 'operator' | 'store' | 'supplier';

export interface MembershipConsumptionContext {
  readonly realmId: string;
  readonly client: MembershipClient;
  readonly organizationId: string;
}

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
  /** Runtime sessions always provide account, realm and NodeContext; optional only for legacy synthetic fixtures. */
  readonly account?: string;
  readonly realm?: string;
  /** Selected by the server session projection; never inferred from the principal or request headers. */
  readonly membershipClient?: MembershipClient;
  /** Organization that owns the selected Membership's roles, permissions and scopes. */
  readonly governanceOrganization?: string;
  readonly nodeContext?: ResolvedNodeContext;
  readonly session: string;
  readonly membership: string;
  readonly credentialVersion: number;
  readonly accessVersion: number;
  readonly target: 'console' | 'storefront' | 'store' | 'supplier';
  readonly assurance: Readonly<{ level: number; verified?: Date }>;
}

/** A resolved runtime session is never allowed to lose its realm/account binding. */
export interface AuthenticatedActor extends Actor {
  readonly account: string;
  readonly realm: string;
}

/** API runtime sessions additionally carry the server-resolved node context. */
export interface NodeContextActor extends AuthenticatedActor {
  readonly nodeContext: ResolvedNodeContext;
  readonly membershipClient: MembershipClient;
  readonly governanceOrganization: string;
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

export function bindRequestNodeContext<T extends object>(
  headers: T,
  nodeContext: ResolvedNodeContext,
): T {
  requestNodeContexts.set(headers, nodeContext);
  return headers;
}

export function requestNodeContext(headers: object): ResolvedNodeContext | undefined {
  return requestNodeContexts.get(headers);
}

export function requireRequestNodeContext(headers: object): ResolvedNodeContext {
  const nodeContext = requestNodeContexts.get(headers);
  if (nodeContext === undefined) throw new Error('SFL_REQUEST_NODE_CONTEXT_MISSING');
  return nodeContext;
}

export function requireActorNodeContext(actor: Actor): ResolvedNodeContext {
  if (actor.nodeContext === undefined) throw new Error('SFL_ACTOR_NODE_CONTEXT_MISSING');
  return actor.nodeContext;
}

export function requireMembershipConsumptionContext(actor: Actor): MembershipConsumptionContext {
  if (!actor.realm || !actor.membershipClient || !actor.governanceOrganization) {
    throw new Error('AUTH_MEMBERSHIP_CONTEXT_MISSING');
  }
  return Object.freeze({
    realmId: actor.realm,
    client: actor.membershipClient,
    organizationId: actor.governanceOrganization,
  });
}

export function bindScopeNodeContext(scope: Scope, nodeContext: ResolvedNodeContext): Scope {
  scopeNodeContexts.set(scope, nodeContext);
  return scope;
}

export function requireScopeNodeContext(scope: Scope): ResolvedNodeContext {
  const nodeContext = scopeNodeContexts.get(scope);
  if (nodeContext === undefined) throw new Error('SFL_SCOPE_NODE_CONTEXT_MISSING');
  return nodeContext;
}

export function requireAccessNodeContext(access: AccessContext): ResolvedNodeContext {
  return requireActorNodeContext(access.actor);
}

export function requireGovernanceContext(access: AccessContext): GovernanceContext {
  if (!access.governance) throw new Error('GOVERNANCE_CONTEXT_MISSING');
  return access.governance;
}
