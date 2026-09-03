import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';
import type { Membership } from '../model/Membership';
import { mapMemberships } from './AccountMapper';
import { mapFavorites } from './AccountMapper';
import type { Favorite } from '../model/Favorite';
import type { OperationOutputFor } from '@shop/contract';
import type { AddressDraft } from '../model/Address';

export class AccountGateway {
  constructor(
    private readonly member: StorefrontClient['commerce']['member'],
    private readonly identity: StorefrontClient['commerce']['identity'],
    private readonly context: StorefrontClient['context']
  ) {}
  profile(session: StorefrontSession, signal?: AbortSignal): Promise<OperationOutputFor<'member.profile.read'>> {
    return this.member.profileRead({}, this.context(session, { signal }));
  }

  addresses(session: StorefrontSession, signal?: AbortSignal): Promise<OperationOutputFor<'member.addresses.read'>> {
    return this.member.addressesRead({ query: { limit: 50 } }, this.context(session, { signal }));
  }

  changeAddress(session: StorefrontSession, addressId: string, draft: AddressDraft | null, expectedVersion: number, idempotencyKey: string) {
    return this.member.addressesManage(
      {
        path: { addressid: addressId },
        body: draft
          ? {
              recipient: draft.recipient,
              mobile: draft.mobile,
              address: draft.detail,
              region: [draft.province, draft.city, draft.district].filter(Boolean).join('/'),
              status: 'active' as const,
            }
          : { status: 'deleted' as const },
      },
      this.context(session, { write: true, expectedVersion, idempotencyKey })
    );
  }

  async memberships(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Membership[]> {
    const value = await this.identity.membershipsRead({}, this.context(session, { signal, includeScope: false }));
    return mapMemberships(value);
  }

  async switchMembership(session: StorefrontSession, membershipId: string, idempotencyKey: string): Promise<void> {
    await this.identity.membershipsSwitch({ body: { membershipId } }, this.context(session, { write: true, includeScope: false, idempotencyKey }));
  }

  async favorites(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Favorite[]> {
    const value = await this.member.favoritesRead({ query: { limit: 100 } }, this.context(session, { signal }));
    return mapFavorites(value);
  }

  async changeFavorite(session: StorefrontSession, listingId: string, favorite: boolean, idempotencyKey: string): Promise<void> {
    await this.member.favoritesPut({ path: { listingid: listingId }, body: { favorite } }, this.context(session, { write: true, idempotencyKey }));
  }
}
