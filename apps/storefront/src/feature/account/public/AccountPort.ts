import type { StorefrontSession } from '../../../entity/session';
import type { BenefitBalances } from '../../benefit/public/BenefitReader';
import type { Address, AddressDraft } from '../model/Address';
import type { Favorite } from '../model/Favorite';
import type { Membership } from '../model/Membership';
import type { Profile } from '../model/Profile';

export interface AccountPort {
  profile(session: StorefrontSession, balances: BenefitBalances, signal?: AbortSignal): Promise<Profile>;
  addresses(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Address[]>;
  changeAddress(session: StorefrontSession, addressId: string, draft: AddressDraft | null, expectedVersion: number, idempotencyKey: string): Promise<unknown>;
  memberships(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Membership[]>;
  switchMembership(session: StorefrontSession, membershipId: string, idempotencyKey: string): Promise<void>;
  favorites(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Favorite[]>;
  changeFavorite(session: StorefrontSession, listingId: string, favorite: boolean, idempotencyKey: string): Promise<void>;
}
