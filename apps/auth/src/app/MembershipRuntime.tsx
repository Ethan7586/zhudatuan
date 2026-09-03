import { useEffect, useRef, useState } from 'react';
import type { FailureView } from '@shop/presentation';
import { presentError } from '@shop/presentation';
import type { AuthTarget } from '@shop/config/client';
import type { Dependencies } from './Dependencies';
import type { Membership } from '../feature/membership/model/Membership';
import { MembershipPage } from '../feature/membership/ui/MembershipPage';

export default function MembershipRuntime({ dependencies, target, onRestart }: Readonly<{
  dependencies: Dependencies;
  target: AuthTarget;
  onRestart: () => void;
}>) {
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
    void dependencies.memberships.execute(target, request.signal).then(
      (value) => {
        if (!request.signal.aborted) setMemberships(value.memberships);
      },
      (cause: unknown) => {
        if (!request.signal.aborted) setFailureView(presentError(cause));
      }
    ).finally(() => {
      if (!request.signal.aborted) setBusy(false);
    });
    return () => request.abort();
  }, [dependencies.memberships, target]);

  const select = (membership: Membership) => {
    if (busy) return;
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setBusy(true);
    setFailureView(undefined);
    void dependencies.selectMembership.execute(membership.id, target, request.signal).then(
      ({ redirectUrl }) => {
        if (!request.signal.aborted) window.location.replace(redirectUrl);
      },
      (cause: unknown) => {
        if (!request.signal.aborted) setFailureView(presentError(cause));
      }
    ).finally(() => {
      if (!request.signal.aborted) setBusy(false);
    });
  };

  return <MembershipPage memberships={memberships} busy={busy} {...(failureView ? { failure: failureView } : {})} onSelect={select} onRestart={onRestart} />;
}
