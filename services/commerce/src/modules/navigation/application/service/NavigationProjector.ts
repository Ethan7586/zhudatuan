import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { AccessContext } from '../../../../platform/security/AccessContext';
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
    private readonly organization: NavigationOrganizationPort,
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
    const scopes = await this.organization.read(context, memberships);
    if (signal?.aborted) throw signal.reason;
    const scope = this.scopes.select(scopes, requestedScope, accessContext.actor.target);
    if (scope.id !== accessContext.scope.id || scope.kind !== accessContext.scope.kind || accessContext.actor.membership !== accessContext.membership.id) {
      throw new DomainError('NAVIGATION_SCOPE_DENIED');
    }
    const permissions = effectivePermissions(accessContext);
    const navigation = new NavigationContext({
      target: accessContext.actor.target,
      principal: accessContext.actor.id,
      membership: accessContext.membership.id,
      membershipActive: accessContext.membership.active,
      assurance: accessContext.assurance.level,
      scope,
      scopes,
      permissions,
      capabilities: accessContext.capabilities,
      featureFlags: this.featureFlags,
      accessVersion: accessContext.accessVersion,
      capabilityVersion: accessContext.capabilityVersion,
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

function effectivePermissions(context: AccessContext): ReadonlySet<string> {
  return new Set([...context.membership.permissions.allows].filter((permission) => !context.membership.permissions.denies.has(permission)));
}

function enabled(nodes: readonly import('../../domain/model/NavigationNode').NavigationNodeValue[]): import('../../domain/model/NavigationNode').NavigationNodeValue | undefined {
  for (const node of nodes) {
    if (!node.experience.disabled) return node;
    const child = enabled(node.children);
    if (child) return child;
  }
  return undefined;
}
