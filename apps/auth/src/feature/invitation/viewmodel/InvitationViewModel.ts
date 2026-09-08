import type { ResolveInvitation } from '../application/ResolveInvitation';
import { useEffect, useMemo, useRef } from 'react';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';

export class InvitationViewModel {
  constructor(private readonly resolver: ResolveInvitation) {}
  resolve(input: Parameters<ResolveInvitation['execute']>[0]) {
    return this.resolver.execute(input);
  }
}

export function useInvitationForm(busy: boolean, onSubmit: (code: string) => Promise<void>) {
  const input = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const secret = useMemo(() => new Secret(), []);
  useEffect(() => () => clearSecretInput(input.current, secret), [secret]);
  const submit = async () => {
    if (submitting.current || busy) return;
    submitting.current = true;
    try {
      await onSubmit(secret.take().trim());
    } finally {
      submitting.current = false;
      clearSecretInput(input.current, secret);
    }
  };
  return Object.freeze({ input, setCode: (value: string) => secret.set(value), submit });
}
