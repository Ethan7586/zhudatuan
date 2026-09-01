import { DomainError } from '../../../../foundation/domain/DomainError';
import { Singleflight } from '../../../../foundation/performance/Singleflight';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AccessContext } from '../../../../foundation/security/AccessContext';
import { NAVIGATION_CONFIGURATION } from '@shop/config/server';
import type { NavigationCacheRepository } from '../port/NavigationCacheRepository';
import type { NavigationProjectionRepository } from '../port/NavigationProjectionRepository';
import { NavigationKey } from '../../domain/model/NavigationKey';

export class ReadNavigationTree {
  constructor(
    private readonly projections: NavigationProjectionRepository,
    private readonly cache: NavigationCacheRepository,
    private readonly flights: Singleflight,
    private readonly secret: string,
    private readonly catalogHash: string
  ) {}

  async execute(transaction: ReadTransactionContext, access: AccessContext, requestedScope?: string, execution: Readonly<{ signal?: AbortSignal; deadline?: number }> = {}) {
    const scope = requestedScope ?? access.scope.id;
    if (!scope || scope.length > 255) throw new DomainError('NAVIGATION_SCOPE_DENIED');
    const pointer = NavigationKey.pointer(this.secret, {
      catalog: this.catalogHash,
      target: access.actor.target,
      principal: access.actor.id,
      membership: access.membership.id,
      scope,
      accessVersion: access.accessVersion,
      capabilityVersion: access.capabilityVersion,
    });
    const cached = await this.cache.get(pointer);
    if (cached) return { status: 200, body: cached.toValue(), headers: { etag: cached.etag, 'x-navigation-catalog': cached.catalogVersion } };
    const configuredDeadline = Date.now() + NAVIGATION_CONFIGURATION.rebuildDeadlineMilliseconds;
    const deadline = execution.deadline === undefined ? configuredDeadline : Math.min(execution.deadline, configuredDeadline);
    const projection = await this.flights.run(pointer, (signal) => this.projections.project(transaction, access, scope, signal), { ...(execution.signal === undefined ? {} : { signal: execution.signal }), deadline });
    const value = projection.tree.toValue();
    await this.cache.put(pointer, projection.key, value);
    return { status: 200, body: value, headers: { etag: value.etag, 'x-navigation-catalog': value.catalogVersion } };
  }
}
