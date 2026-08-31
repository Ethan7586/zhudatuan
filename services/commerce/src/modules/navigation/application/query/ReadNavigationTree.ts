import { DomainError } from '../../../../foundation/domain/DomainError';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { AccessContext } from '../../../../foundation/security/AccessContext';
import { Singleflight } from '../../../../foundation/performance/Singleflight';
import type { OperationResult } from '../../../../foundation/application/OperationExecution';
import { NAVIGATION_CONFIGURATION } from '@shop/config/server';
import type { NavigationCache } from '../port/NavigationCache';
import type { NavigationProjector } from '../projection/NavigationProjector';
import { NavigationKey } from '../../domain/model/NavigationKey';

export class ReadNavigationTree {
  constructor(
    private readonly database: DatabasePool,
    private readonly cache: NavigationCache,
    private readonly projector: NavigationProjector,
    private readonly flights: Singleflight,
    private readonly secret: string,
    private readonly catalogHash: string
  ) {}

  async execute(access: AccessContext, requestedScope?: string, execution: Readonly<{ signal?: AbortSignal; deadline?: number }> = {}): Promise<OperationResult> {
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
    const projection = await this.flights.run(pointer, (signal) => this.projector.project(this.database, access, scope, signal), { ...(execution.signal === undefined ? {} : { signal: execution.signal }), deadline });
    const value = projection.tree.toValue();
    await this.cache.put(pointer, projection.key, value);
    return { status: 200, body: value, headers: { etag: value.etag, 'x-navigation-catalog': value.catalogVersion } };
  }
}
