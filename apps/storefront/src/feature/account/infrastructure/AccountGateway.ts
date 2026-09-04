import type { IdentityOperations } from '@shop/sdk/identity';
import type { MemberOperations } from '@shop/sdk/member';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { Membership } from '../model/Membership';
import { mapAddresses, mapFavorites, mapMemberships, mapProfile } from './AccountMapper';
import type { Favorite } from '../model/Favorite';
import type { AddressDraft } from '../model/Address';
import type { Address } from '../model/Address';
import type { Profile } from '../model/Profile';
import type { BenefitBalances } from '../../benefit/public/BenefitReader';
import type { AccountPort } from '../public/AccountPort';

export class AccountGateway implements AccountPort {
  constructor(
    private readonly member: MemberOperations,
    private readonly identity: IdentityOperations,
    private readonly context: RequestContextFactory
  ) {}
  async profile(session: StorefrontSession, balances: BenefitBalances, signal?: AbortSignal): Promise<Profile> {
    return mapProfile(await this.member.profileRead({}, this.context(session, { signal })), balances);
  }

  async addresses(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Address[]> {
    return mapAddresses(await this.member.addressesRead({ query: { limit: 50 } }, this.context(session, { signal })));
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
              is_default: draft.isDefault,
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
