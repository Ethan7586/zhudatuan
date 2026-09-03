import type { CompleteEnrollment } from '../application/CompleteEnrollment';
import type { ReadEnrollment } from '../application/ReadEnrollment';
import type { ResolveInvitation } from '../application/ResolveInvitation';
import { useEffect, useMemo, useRef } from 'react';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';

export class InvitationViewModel {
  constructor(private readonly resolver: ResolveInvitation, private readonly enrollment: ReadEnrollment, private readonly completion: CompleteEnrollment) {}
  resolve(input: Parameters<ResolveInvitation['execute']>[0]) { return this.resolver.execute(input); }
  read(id: string, signal?: AbortSignal) { return this.enrollment.execute(id, signal); }
  complete(input: Parameters<CompleteEnrollment['execute']>[0], signal?: AbortSignal) { return this.completion.execute(input, signal); }
}

export function useInvitationProof(onSubmit: (code: string) => Promise<void>) {
  const input = useRef<HTMLInputElement>(null);
  const secret = useMemo(() => new Secret(), []);
  useEffect(() => { input.current?.focus(); return () => clearSecretInput(input.current, secret); }, [secret]);
  const submit = async () => { const code = secret.take(); try { await onSubmit(code); } finally { clearSecretInput(input.current, secret); requestAnimationFrame(() => input.current?.focus()); } };
  return Object.freeze({ input, setCode: (value: string) => secret.set(value), submit });
}
