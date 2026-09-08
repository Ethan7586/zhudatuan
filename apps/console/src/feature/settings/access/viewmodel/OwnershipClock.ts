import { useEffect, useState } from 'react';
import type { Ownership } from '../model/Access';

export function useOwnershipClock(ownership: Ownership | undefined) {
  const pending = ownership?.pending ?? null;
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (pending?.state !== 'pending') return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [pending?.id, pending?.state]);
  const coolingRemaining = pending === null ? 0 : Math.max(0, new Date(pending.coolingUntil).getTime() - clock);
  const pendingActive = pending?.state === 'pending' && new Date(pending.expiresAt).getTime() > clock;
  return Object.freeze({ coolingRemaining, pendingActive });
}
