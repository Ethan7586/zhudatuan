import { useEffect, useRef, useState } from 'react';
import type { FailureView } from '@shop/presentation';
import { presentError } from '@shop/presentation';
import type { Dependencies } from '../../../app/Dependencies';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { Membership } from '../model/Membership';

export function useMembershipViewModel(dependencies: Dependencies, session: SessionRequest) {
  const [memberships, setMemberships] = useState<readonly Membership[]>([]);
  const [failureView, setFailureView] = useState<FailureView>();
  const [busy, setBusy] = useState(true);
  const controller = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setBusy(true);
    setFailureView(undefined);
    void dependencies.memberships
      .execute(session, request.signal)
      .then(
        (value) => {
          if (!request.signal.aborted) setMemberships(value.memberships);
        },
        (cause: unknown) => {
          if (!request.signal.aborted) setFailureView(presentError(cause));
        }
      )
      .finally(() => {
        if (!request.signal.aborted) setBusy(false);
      });
    return () => request.abort();
  }, [dependencies.memberships, session]);

  const select = (membership: Membership) => {
    if (busy) return;
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setBusy(true);
    setFailureView(undefined);
    void dependencies.selectMembership
      .execute(membership.id, session, request.signal)
      .then(
        ({ redirectUrl }) => {
          if (!request.signal.aborted) dependencies.navigation.replace(redirectUrl);
        },
        (cause: unknown) => {
          if (!request.signal.aborted) setFailureView(presentError(cause));
        }
      )
      .finally(() => {
        if (!request.signal.aborted) setBusy(false);
      });
  };

  return Object.freeze({ memberships, busy, ...(failureView === undefined ? {} : { failure: failureView }), select });
}

export type MembershipViewModel = ReturnType<typeof useMembershipViewModel>;
