import type { MembershipAccess, Scope } from '@shop/authz';
import type { ResolvedNodeContext } from '@shop/config/sfl-node-kernel';
import type { MallContext } from '../../modules/mall';

const requestNodeContexts = new WeakMap<object, ResolvedNodeContext>();
const scopeNodeContexts = new WeakMap<object, ResolvedNodeContext>();

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
  /** Runtime sessions always provide account, realm and NodeContext; optional only for legacy synthetic fixtures. */
  readonly account?: string;
  readonly realm?: string;
  readonly nodeContext?: ResolvedNodeContext;
  readonly session: string;
  readonly membership: string;
  readonly credentialVersion: number;
  readonly accessVersion: number;
  readonly target: 'console' | 'storefront' | 'store' | 'supplier';
  readonly assurance: Readonly<{ level: number; verified?: Date }>;
}

export interface NodeContextActor extends Actor {
  readonly realm: string;
  readonly nodeContext: ResolvedNodeContext;
}

export interface AuthenticatedActor extends NodeContextActor {
  readonly account: string;
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
