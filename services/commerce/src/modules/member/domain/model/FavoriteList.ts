import { DomainError } from '../../../../platform/error/DomainError';
import type { FavoriteVisibility } from '../policy/FavoritePolicy';
import { FavoritePolicy } from '../policy/FavoritePolicy';

export type FavoriteState = 'active' | 'removed';

export interface FavoriteEntry {
  readonly listing: string;
  readonly createdAt: string;
  readonly state: FavoriteState;
  readonly version: number;
}

export class FavoriteList {
  readonly member: string;
  private readonly policy: FavoritePolicy;

  constructor(member: string, policy = new FavoritePolicy()) {
    if (!member.startsWith('member:')) throw new DomainError('VALIDATION_FAILED', { field: 'memberId' });
    this.member = member;
    this.policy = policy;
    Object.freeze(this);
  }

  change(listing: string, favorite: boolean, visibility: FavoriteVisibility): Readonly<{ listing: string; state: FavoriteState }> {
    if (!listing) throw new DomainError('VALIDATION_FAILED', { field: 'listingId' });
    if (favorite) this.policy.assertVisible(visibility);
    return Object.freeze({ listing, state: favorite ? 'active' : 'removed' });
  }

  present(entry: FavoriteEntry, visibility: FavoriteVisibility) {
    if (entry.state !== 'active') throw new Error('MEMBER_REMOVED_FAVORITE_PROJECTED');
    const availability = this.policy.availability(visibility);
    return Object.freeze({
      listingId: entry.listing,
      createdAt: entry.createdAt,
      version: entry.version,
      available: availability.available,
      unavailableReason: availability.reason,
    });
  }
}
