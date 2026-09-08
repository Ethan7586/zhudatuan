import { useEffect, useMemo, useRef, useState } from 'react';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';
import type { ActionResult } from '../../../shared/ui/ActionResult';
import { useCooldown, type Challenge } from '../../challenge';

export function usePasswordForm(onSubmit: (subject: string, password: string) => void) {
  const [subject, setSubject] = useState('');
  const [visible, setVisible] = useState(false);
  const password = useMemo(() => new Secret(), []);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => clearSecretInput(input.current, password), [password]);
  return Object.freeze({
    subject,
    visible,
    input,
    setSubject,
    setPassword: (value: string) => password.set(value),
    toggle: () => setVisible((value) => !value),
    submit: () => {
      onSubmit(subject, password.take());
      clearSecretInput(input.current, password);
    },
  });
}

export function useOtpForm(busy: boolean, onChallenge: (subject: string) => Promise<ActionResult<Challenge>>, onSubmit: (subject: string, challenge: string, code: string) => void) {
  const [subject, setSubjectValue] = useState('');
  const [challenge, setChallenge] = useState<Challenge>();
  const [challengeSubject, setChallengeSubject] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const sendingActive = useRef(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const cooldown = useCooldown();
  const setSubject = (value: string) => {
    setSubjectValue(value);
    setChallenge(undefined);
    setCode('');
    cooldown.clear();
  };
  const send = async () => {
    if (sendingActive.current || busy || cooldown.seconds > 0) return;
    sendingActive.current = true;
    setSending(true);
    try {
      const result = await onChallenge(subject);
      if (!result.ok) return;
      setChallenge(result.value);
      setChallengeSubject(subject.trim());
      setCode('');
      cooldown.start(result.value.resendSeconds);
      requestAnimationFrame(() => codeRef.current?.focus());
    } finally {
      sendingActive.current = false;
      setSending(false);
    }
  };
  const submit = () => {
    const submitted = code;
    setCode('');
    onSubmit(subject, challengeSubject === subject.trim() ? (challenge?.id ?? '') : '', submitted);
  };
  return Object.freeze({ subject, challenge, code, seconds: cooldown.seconds, sending, codeRef, setSubject, setCode, send, submit });
}
