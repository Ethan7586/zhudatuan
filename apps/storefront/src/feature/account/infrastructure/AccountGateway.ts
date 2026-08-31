import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';
import type { Membership } from '../model/Membership';
import { mapMemberships } from './AccountMapper';
import { mapFavorites } from './AccountMapper';
import type { Favorite } from '../model/Favorite';
import type { OperationOutputFor } from '@shop/contract';
import type { AddressDraft } from '../model/Address';

export const AccountGateway = Object.freeze({
  profile(session: StorefrontSession, signal?: AbortSignal): Promise<OperationOutputFor<'member.profile.read'>> {
    return storefrontClient.commerce.member.profileRead({}, storefrontClient.context(session, { signal }));
  },

  addresses(session: StorefrontSession, signal?: AbortSignal): Promise<OperationOutputFor<'member.addresses.read'>> {
    return storefrontClient.commerce.member.addressesRead({ query: { limit: 50 } }, storefrontClient.context(session, { signal }));
  },

  changeAddress(session: StorefrontSession, addressId: string, draft: AddressDraft | null, expectedVersion: number, idempotencyKey: string) {
    return storefrontClient.commerce.member.addressesManage(
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
      storefrontClient.context(session, { write: true, expectedVersion, idempotencyKey })
    );
  },

  async memberships(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Membership[]> {
    const value = await storefrontClient.commerce.identity.membershipsRead({}, storefrontClient.context(session, { signal, includeScope: false }));
    return mapMemberships(value);
  },

  async switchMembership(session: StorefrontSession, membershipId: string, idempotencyKey: string): Promise<void> {
    await storefrontClient.commerce.identity.membershipsSwitch({ body: { membershipId } }, storefrontClient.context(session, { write: true, includeScope: false, idempotencyKey }));
  },

  async favorites(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Favorite[]> {
    const value = await storefrontClient.commerce.member.favoritesRead({ query: { limit: 100 } }, storefrontClient.context(session, { signal }));
    return mapFavorites(value);
  },

  async changeFavorite(session: StorefrontSession, listingId: string, favorite: boolean, idempotencyKey: string): Promise<void> {
    await storefrontClient.commerce.member.favoritesPut({ path: { listingid: listingId }, body: { favorite } }, storefrontClient.context(session, { write: true, idempotencyKey }));
  },
});
