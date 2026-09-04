import type { ResolveInvitation } from '../application/ResolveInvitation';
import { useEffect, useMemo, useRef } from 'react';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';

export class InvitationViewModel {
  constructor(private readonly resolver: ResolveInvitation) {}
  resolve(input: Parameters<ResolveInvitation['execute']>[0]) {
    return this.resolver.execute(input);
  }
}

export function useInvitationProof(onSubmit: (code: string) => Promise<void>) {
  const input = useRef<HTMLInputElement>(null);
  const secret = useMemo(() => new Secret(), []);
  useEffect(() => {
    input.current?.focus();
    const element = input.current;
    return () => clearSecretInput(element, secret);
  }, [secret]);
  const submit = async () => {
    const code = secret.take();
    try {
      await onSubmit(code);
    } finally {
      clearSecretInput(input.current, secret);
      requestAnimationFrame(() => input.current?.focus());
    }
  };
  return Object.freeze({ input, setCode: (value: string) => secret.set(value), submit });
}
