import { useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import { storefrontAuthHref } from '../../../config/storefrontAuth';
import { benefitBalances } from '../../benefit/public/index';
import { EMPTY_GUEST_PROFILE, UNRESOLVED_MALL } from '../model/ProfileDefaults';
import { ReadProfile } from '../application/ReadProfile';
import { SwitchMembership } from '../application/SwitchMembership';
import { ChangeFavorite } from '../application/ChangeFavorite';
import { ChangeAddress } from '../application/ChangeAddress';
import type { AddressDraft } from '../model/Address';
import { useDependencies } from '../../../app/DependencyContext';

export function useAccountIdentity() {
  const session = useSession();
  const dependencies = useDependencies();
  const client = useQueryClient();
  const profileReader = useRef(new ReadProfile(dependencies.account));
  const membershipCommand = useRef(new SwitchMembership(dependencies.account));
  const favoriteCommand = useRef(new ChangeFavorite(dependencies.account));
  const addressCommand = useRef(new ChangeAddress(dependencies.account));
  const membershipQuery = useQuery({
    queryKey: StorefrontQuery.memberships(session.query.scoped),
    queryFn: ({ signal }) => dependencies.account.memberships(session.session!, signal),
    enabled: session.status === 'authenticated',
  });
  const currentMembership = membershipQuery.data?.find(({ current }) => current);
  const mall = useMemo(
    () =>
      session.scope
        ? Object.freeze({
            id: session.scope,
            membershipId: currentMembership?.id,
            enterpriseId: currentMembership?.organizationId ?? session.scope,
            enterpriseName: currentMembership?.name ?? session.scope,
            mallName: currentMembership?.name ?? session.scope,
            logoText: (currentMembership?.name ?? session.scope).slice(0, 4),
            badge: '当前商城',
            welcomeBanner: '企业员工福利商城已开放，实际权益以企业发放为准。',
          })
        : UNRESOLVED_MALL,
    [currentMembership, session.scope]
  );
  const malls = useMemo(
    () =>
      Object.freeze(
        (membershipQuery.data ?? []).map((membership) =>
          Object.freeze({
            id: membership.organizationId,
            membershipId: membership.id,
            enterpriseId: membership.organizationId,
            enterpriseName: membership.name,
            mallName: membership.name,
            logoText: membership.name.slice(0, 4),
            badge: membership.current ? '当前商城' : '可切换',
            welcomeBanner: membership.current ? '当前授权商城' : '可切换授权商城',
          })
        )
      ),
    [membershipQuery.data]
  );
  const profileQuery = useQuery({
    queryKey: StorefrontQuery.profile(session.query.scoped),
    queryFn: async ({ signal }) => profileReader.current.execute(session.session!, benefitBalances(await dependencies.benefit.accounts(session.session!, signal)), signal),
    enabled: session.status === 'authenticated',
  });
  const user = useMemo(
    () =>
      profileQuery.data
        ? Object.freeze({
            ...profileQuery.data,
            enterpriseId: mall.enterpriseId,
            enterpriseName: mall.enterpriseName,
            currentMallId: mall.id,
          })
        : EMPTY_GUEST_PROFILE,
    [mall, profileQuery.data]
  );
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
  const switchMall = (membershipId: string) => {
    if (!session.session || membershipId === session.session.membership) return;
    void membershipCommand.current
      .execute(session.session, membershipId)
      .then(async () => {
        await client.cancelQueries();
        client.clear();
        window.location.assign('/');
      })
      .catch(() => session.showToast('商城切换失败，请重新验证身份后重试', 'error'));
  };
  const toggleFavorite = (listingId: string) => {
    if (!session.session) return void window.location.assign(storefrontAuthHref());
    void favoriteCommand.current
      .execute(session.session, listingId, !favorites.includes(listingId))
      .then(() => client.invalidateQueries({ queryKey: StorefrontQuery.favorites(session.query.scoped) }))
      .catch(() => session.showToast('收藏状态保存失败，请稍后重试', 'error'));
  };
  const saveAddress = async (addressId: string | null, address: AddressDraft, expectedVersion = 0) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await addressCommand.current.save(session.session, addressId ?? `address:${crypto.randomUUID()}`, address, expectedVersion);
    await client.invalidateQueries({ queryKey: StorefrontQuery.addresses(session.query.scoped) });
  };
  const removeAddress = async (addressId: string, expectedVersion: number) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await addressCommand.current.remove(session.session, addressId, expectedVersion);
    await client.invalidateQueries({ queryKey: StorefrontQuery.addresses(session.query.scoped) });
  };
  return Object.freeze({
    user,
    currentMall: mall,
    malls,
    addresses: addressQuery.data ?? Object.freeze([]),
    favorites,
    favoriteItems,
    switchMall,
    toggleFavorite,
    saveAddress,
    removeAddress,
    logout: session.logout,
    showToast: session.showToast,
  });
}
