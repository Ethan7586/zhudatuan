import { useEffect, useState } from 'react';
import type { MembershipChoice, MembershipSelectionState } from '../entity/authentication/AuthenticationState';
import { MembershipPage } from '../feature/membership/MembershipPage';
import { MembershipSelection } from '../feature/selection/MembershipSelection';
import { authentication } from './Authentication';
import { useAuth } from './AuthProvider';

export function MembershipFlow() {
  const { request } = useAuth();
  const client = authentication;
  const [selection, setSelection] = useState<MembershipSelectionState | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    void client
      .membershipSelection(request.target, controller.signal)
      .then(setSelection)
      .catch(() => setError('一次性身份选择信息不可用或已经消费，请返回登录入口重新验证。'))
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [client, request.target]);
  const select = (membership: MembershipChoice) => {
    if (!selection) return;
    setBusy(true);
    setError('');
    void client
      .selectMembership(membership.id, selection.target, request.handle)
      .then((result) => {
        if (result.kind !== 'authenticated') throw new Error('MEMBERSHIP_SELECTION_REQUIRED');
        window.location.replace(result.redirectUrl);
      })
      .catch(() => setError('身份选择已过期或不可用，请重新登录。'))
      .finally(() => setBusy(false));
  };
  return (
    <MembershipPage busy={busy} error={error} hasSelection={selection !== null}>
      {selection && !error ? <MembershipSelection memberships={selection.memberships} busy={busy} onSelect={select} /> : null}
    </MembershipPage>
  );
}
