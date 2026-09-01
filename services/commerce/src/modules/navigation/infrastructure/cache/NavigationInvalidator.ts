import type { NavigationClock } from '../../application/port/NavigationClock';
import type { NavigationCacheRepository, NavigationInvalidationPort } from '../../application/port/NavigationCacheRepository';
import { NavigationKey } from '../../domain/model/NavigationKey';

export interface NavigationInvalidation {
  readonly event: string;
  readonly principal?: string;
  readonly membership?: string;
  readonly scope?: string;
  readonly catalog?: boolean;
}

export class NavigationInvalidator implements NavigationInvalidationPort {
  private latest: string | null = null;
  constructor(
    private readonly cache: NavigationCacheRepository,
    private readonly secret: string,
    private readonly clock: NavigationClock
  ) {}

  async invalidate(value: NavigationInvalidation): Promise<boolean> {
    const indexes = [
      ...(value.principal ? [NavigationKey.index(this.secret, 'principal', value.principal)] : []),
      ...(value.membership ? [NavigationKey.index(this.secret, 'membership', value.membership)] : []),
      ...(value.scope ? [NavigationKey.index(this.secret, 'scope', value.scope)] : []),
    ];
    if (indexes.length === 0 && value.catalog !== true) throw new Error('NAVIGATION_INVALIDATION_SCOPE_MISSING');
    const accepted = await this.cache.accept(value.event, indexes);
    if (accepted) this.latest = this.clock.now().toISOString();
    return accepted;
  }

  lastEventAt(): string | null {
    return this.latest;
  }
}
