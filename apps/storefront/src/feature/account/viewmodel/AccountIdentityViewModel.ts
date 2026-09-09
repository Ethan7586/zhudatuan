import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import { storefrontAuthHref } from '../../../config/storefrontAuth';
import { ChangeFavorite } from '../application/ChangeFavorite';
import { ChangeAddress } from '../application/ChangeAddress';
import type { AddressDraft } from '../model/Address';
import { useDependencies } from '../../../app/DependencyContext';
import { presentError } from '@shop/presentation';
import { useMemberIdentity } from './MemberIdentityViewModel';

export function useAccountIdentity() {
  const session = useSession();
  const dependencies = useDependencies();
  const client = useQueryClient();
  const identity = useMemberIdentity();
  const favoriteCommand = useRef(new ChangeFavorite(dependencies.account));
  const addressCommand = useRef(new ChangeAddress(dependencies.account));
  const addressQuery = useQuery({
    queryKey: StorefrontQuery.addresses(session.query.scoped),
    queryFn: ({ signal }) => dependencies.account.addresses(session.session!, signal),
    enabled: session.status === 'authenticated',
  });
  const favoriteQuery = useQuery({
    queryKey: StorefrontQuery.favorites(session.query.scoped),
    queryFn: ({ signal }) => dependencies.account.favorites(session.session!, signal),
    enabled: session.status === 'authenticated',
  });
  const favoriteItems = favoriteQuery.data ?? Object.freeze([]);
  const favorites = Object.freeze(favoriteItems.map(({ listingId }) => listingId));
  const toggleFavorite = (listingId: string) => {
    if (!session.session) return void window.location.assign(storefrontAuthHref());
    void favoriteCommand.current
      .execute(session.session, listingId, !favorites.includes(listingId))
      .then(() => client.invalidateQueries({ queryKey: StorefrontQuery.favorites(session.query.scoped) }))
      .catch(() => session.showToast('收藏状态保存失败，请稍后重试', 'error'));
  };
  const saveAddress = async (addressId: string | null, address: AddressDraft, expectedVersion = 0, idempotencyKey?: string) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await addressCommand.current.save(session.session, addressId ?? `address:${idempotencyKey ?? crypto.randomUUID()}`, address, expectedVersion, idempotencyKey);
    await client.invalidateQueries({ queryKey: StorefrontQuery.addresses(session.query.scoped) });
  };
  const removeAddress = async (addressId: string, expectedVersion: number, idempotencyKey?: string) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await addressCommand.current.remove(session.session, addressId, expectedVersion, idempotencyKey);
    await client.invalidateQueries({ queryKey: StorefrontQuery.addresses(session.query.scoped) });
  };
  return Object.freeze({
    ...identity,
    addresses: addressQuery.data ?? Object.freeze([]),
    favorites,
    favoriteItems,
    addressState: addressQuery.isPending ? ('loading' as const) : addressQuery.isError ? ('failed' as const) : addressQuery.data?.length === 0 ? ('empty' as const) : ('ready' as const),
    favoriteState: favoriteQuery.isPending ? ('loading' as const) : favoriteQuery.isError ? ('failed' as const) : favoriteItems.length === 0 ? ('empty' as const) : ('ready' as const),
    addressMessage: addressQuery.isError ? presentError(addressQuery.error).message : null,
    favoriteMessage: favoriteQuery.isError ? presentError(favoriteQuery.error).message : null,
    toggleFavorite,
    saveAddress,
    removeAddress,
    retryAddresses: addressQuery.refetch,
    retryFavorites: favoriteQuery.refetch,
  });
}
