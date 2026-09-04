import type { NavigationClock } from '../../application/port/NavigationClock';
import type { NavigationCacheRepository, NavigationInvalidationPort } from '../../application/port/NavigationCacheRepository';
import { NavigationKey } from '../../domain/model/NavigationKey';

export interface NavigationInvalidation {
  readonly event: string;
  readonly principals?: readonly string[];
  readonly memberships?: readonly string[];
  readonly scopes?: readonly string[];
  readonly targets?: readonly string[];
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
      ...(value.catalog === true ? [NavigationKey.global(this.secret)] : []),
      ...(value.principals ?? []).map((principal) => NavigationKey.index(this.secret, 'principal', principal)),
      ...(value.memberships ?? []).map((membership) => NavigationKey.index(this.secret, 'membership', membership)),
      ...(value.scopes ?? []).map((scope) => NavigationKey.index(this.secret, 'scope', scope)),
      ...(value.targets ?? []).map((target) => NavigationKey.index(this.secret, 'target', target)),
    ];
    if (indexes.length === 0) throw new Error('NAVIGATION_INVALIDATION_SCOPE_MISSING');
    const accepted = await this.cache.accept(value.event, indexes);
    if (accepted) this.latest = this.clock.now().toISOString();
    return accepted;
  }

  lastEventAt(): string | null {
    return this.latest;
  }
}
