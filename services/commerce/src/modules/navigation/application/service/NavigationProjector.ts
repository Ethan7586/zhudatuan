import { DomainError } from '../../../../foundation/domain/DomainError';
import { NAVIGATION_CONFIGURATION } from '@shop/config/server';
import { allParallel } from '../../../../foundation/performance/Parallel';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AccessContext } from '../../../../foundation/security/AccessContext';
import type { NavigationAccessPort } from '../../../access/public';
import type { NavigationCapabilityPort } from '../../../capability/public';
import type { MembershipContextPort } from '../../../identity/public';
import type { NavigationOrganizationPort } from '../../../organization/public';
import { NavigationContext } from '../../domain/model/NavigationContext';
import { NavigationKey } from '../../domain/model/NavigationKey';
import { NavigationTree } from '../../domain/model/NavigationTree';
import { ScopePolicy } from '../../domain/policy/ScopePolicy';
import type { NavigationClock } from '../port/NavigationClock';
import { NavigationFilter } from './NavigationFilter';
import { navigationVersion } from './NavigationVersion';

export interface NavigationProjection {
  readonly key: NavigationKey;
  readonly tree: NavigationTree;
}

export class NavigationProjector {
  constructor(
    private readonly identity: MembershipContextPort,
    private readonly access: NavigationAccessPort,
    private readonly organization: NavigationOrganizationPort,
    private readonly capability: NavigationCapabilityPort,
    private readonly clock: NavigationClock,
    private readonly secret: string,
    private readonly catalog: readonly import('./NavigationFilter').CatalogNavigationNode[],
    private readonly catalogHash: string,
    private readonly filter = new NavigationFilter(),
    private readonly scopes = new ScopePolicy(),
    private readonly featureFlags: ReadonlySet<string> = new Set(catalog.flatMap((node) => node.featureFlags))
  ) {}

  async project(context: ReadTransactionContext, accessContext: AccessContext, requestedScope: string, signal?: AbortSignal): Promise<NavigationProjection> {
    if (signal?.aborted) throw signal.reason;
    const memberships = Object.freeze([accessContext.membership.id]);
    const [identity, accesses, scopes, capabilities] = await allParallel(
      [
        () => this.identity.read(context, accessContext.actor.id, accessContext.membership.id),
        () => this.access.read(context, memberships),
        () => this.organization.read(context, memberships),
        () => this.capability.read(context, Object.freeze([requestedScope]), accessContext.actor.target),
      ] as const,
      { concurrency: 4, expiresAt: Date.now() + NAVIGATION_CONFIGURATION.rebuildDeadlineMilliseconds, signal: signal ?? new AbortController().signal }
    );
    const access = accesses[0];
    const scope = this.scopes.select(scopes, requestedScope, accessContext.actor.target);
    const capability = capabilities.find((candidate) => candidate.scope === scope.id);
    if (!access || identity.accessVersion !== accessContext.accessVersion || access.version !== accessContext.accessVersion) {
      throw new DomainError('ACCESS_VERSION_STALE');
    }
    if ((capability?.version ?? 0) !== accessContext.capabilityVersion) throw new Error('CAPABILITY_VERSION_STALE');
    const navigation = new NavigationContext({
      target: accessContext.actor.target,
      principal: identity.principal,
      membership: identity.membership,
      membershipActive: identity.membershipStatus === 'active',
      assurance: identity.assurance,
      scope,
      scopes,
      permissions: access.permissions,
      capabilities: capability?.capabilities ?? new Set<string>(),
      featureFlags: this.featureFlags,
      accessVersion: access.version,
      capabilityVersion: capability?.version ?? 0,
    });
    const nodes = this.filter.apply(this.catalog, navigation);
    const version = navigationVersion(this.catalogHash, navigation);
    const landing = enabled(nodes);
    if (!landing) throw new DomainError('NAVIGATION_EMPTY');
    const tree = new NavigationTree({
      scope: { id: scope.id, kind: scope.kind },
      target: navigation.target,
      version: version.version,
      etag: version.etag,
      generatedAt: this.clock.now().toISOString(),
      catalogVersion: this.catalogHash,
      defaultKey: landing.key,
      defaultRoute: landing.experience.route,
      nodes,
    });
    return Object.freeze({
      key: new NavigationKey(this.secret, {
        catalog: this.catalogHash,
        target: navigation.target,
        principal: navigation.principal,
        membership: navigation.membership,
        scope: navigation.scope.id,
        accessVersion: navigation.accessVersion,
        capabilityVersion: navigation.capabilityVersion,
        featureVersion: version.featureVersion,
      }),
      tree,
    });
  }
}

function enabled(nodes: readonly import('../../domain/model/NavigationNode').NavigationNodeValue[]): import('../../domain/model/NavigationNode').NavigationNodeValue | undefined {
  for (const node of nodes) {
    if (!node.experience.disabled) return node;
    const child = enabled(node.children);
    if (child) return child;
  }
  return undefined;
}
