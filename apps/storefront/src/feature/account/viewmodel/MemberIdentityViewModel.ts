import { useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import { benefitBalances } from '../../benefit/public/index';
import { ReadProfile } from '../application/ReadProfile';
import { SwitchMembership } from '../application/SwitchMembership';
import { EMPTY_GUEST_PROFILE, UNRESOLVED_MALL } from '../model/ProfileDefaults';
import { presentCurrentMall, presentMembershipMall } from '../model/MallPresentation';

export function useMemberIdentity() {
  const session = useSession();
  const dependencies = useDependencies();
  const client = useQueryClient();
  const profileReader = useRef(new ReadProfile(dependencies.account));
  const membershipCommand = useRef(new SwitchMembership(dependencies.account));
  const membershipQuery = useQuery({
    queryKey: StorefrontQuery.memberships(session.query.scoped),
    queryFn: ({ signal }) => dependencies.account.memberships(session.session!, signal),
    enabled: session.status === 'authenticated',
  });
  const currentMembership = membershipQuery.data?.find(({ current }) => current);
  const currentMall = useMemo(() => (session.scope ? presentCurrentMall(session.scope, currentMembership) : UNRESOLVED_MALL), [currentMembership, session.scope]);
  const malls = useMemo(() => Object.freeze((membershipQuery.data ?? []).map(presentMembershipMall)), [membershipQuery.data]);
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
            enterpriseId: currentMall.enterpriseId,
            enterpriseName: currentMall.enterpriseName,
            department: currentMall.enterpriseName,
            currentMallId: currentMall.id,
          })
        : EMPTY_GUEST_PROFILE,
    [currentMall, profileQuery.data]
  );
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
  return Object.freeze({
    user,
    currentMall,
    malls,
    profileState: profileQuery.isPending ? ('loading' as const) : profileQuery.isError ? ('failed' as const) : ('ready' as const),
    membershipState: membershipQuery.isPending ? ('loading' as const) : membershipQuery.isError ? ('failed' as const) : ('ready' as const),
    profileMessage: profileQuery.isError ? presentError(profileQuery.error).message : null,
    membershipMessage: membershipQuery.isError ? presentError(membershipQuery.error).message : null,
    switchMall,
    logout: session.logout,
    showToast: session.showToast,
    retryProfile: profileQuery.refetch,
    retryMemberships: membershipQuery.refetch,
  });
}
