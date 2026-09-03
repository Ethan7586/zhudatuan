import { useEffect, useMemo, useRef, useState } from 'react';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';
import type { ActionResult } from '../../../shared/ui/ActionResult';
import { useCooldown } from '../../challenge/viewmodel/ChallengeViewModel';

export function usePasswordForm(onSubmit: (subject: string, password: string) => void) {
  const [subject, setSubject] = useState('');
  const [visible, setVisible] = useState(false);
  const password = useMemo(() => new Secret(), []);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => clearSecretInput(input.current, password), [password]);
  return Object.freeze({ subject, visible, input, setSubject, setPassword: (value: string) => password.set(value), toggle: () => setVisible((value) => !value), submit: () => { onSubmit(subject, password.take()); clearSecretInput(input.current, password); } });
}

export function useOtpForm(busy: boolean, onChallenge: (subject: string) => Promise<ActionResult<Readonly<{ id: string; resendSeconds: number }>>>, onSubmit: (subject: string, challenge: string, code: string) => void) {
  const [subject, setSubjectValue] = useState('');
  const [challenge, setChallenge] = useState('');
  const [challengeSubject, setChallengeSubject] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const sendingActive = useRef(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const cooldown = useCooldown();
  const setSubject = (value: string) => { setSubjectValue(value); setChallenge(''); setCode(''); cooldown.clear(); };
  const send = async () => {
    if (sendingActive.current || busy || cooldown.seconds > 0) return;
    sendingActive.current = true; setSending(true);
    try { const result = await onChallenge(subject); if (!result.ok) return; setChallenge(result.value.id); setChallengeSubject(subject.trim()); setCode(''); cooldown.start(result.value.resendSeconds); requestAnimationFrame(() => codeRef.current?.focus()); }
    finally { sendingActive.current = false; setSending(false); }
  };
  const submit = () => { const submitted = code; setCode(''); onSubmit(subject, challengeSubject === subject.trim() ? challenge : '', submitted); };
  return Object.freeze({ subject, code, seconds: cooldown.seconds, sending, codeRef, setSubject, setCode, send, submit });
}

export function useInvitationForm(busy: boolean, onSubmit: (code: string) => Promise<void>) {
  const input = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const secret = useMemo(() => new Secret(), []);
  useEffect(() => () => clearSecretInput(input.current, secret), [secret]);
  const submit = async () => {
    if (submitting.current || busy) return;
    submitting.current = true;
    try { await onSubmit(secret.take().trim()); }
    finally { submitting.current = false; clearSecretInput(input.current, secret); }
  };
  return Object.freeze({ input, setCode: (value: string) => secret.set(value), submit });
}

export function usePolicy() {
  const [policy, setPolicy] = useState<'terms' | 'privacy'>();
  return Object.freeze({ policy, open: setPolicy, close: () => setPolicy(undefined) });
}
