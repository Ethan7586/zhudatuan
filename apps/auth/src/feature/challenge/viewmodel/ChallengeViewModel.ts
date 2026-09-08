import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';

export function useProofForm(onSubmit: (code: string) => Promise<void>) {
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

export function useCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);
  const start = useCallback((value: number) => setSeconds(Math.max(0, value)), []);
  const clear = useCallback(() => setSeconds(0), []);
  return Object.freeze({ seconds, start, clear });
}

export function useRemainingSeconds(timestamp: string): number {
  const [seconds, setSeconds] = useState(() => remainingSeconds(timestamp));
  useEffect(() => {
    setSeconds(remainingSeconds(timestamp));
    const timer = window.setInterval(() => setSeconds(remainingSeconds(timestamp)), 1_000);
    return () => window.clearInterval(timer);
  }, [timestamp]);
  return seconds;
}

function remainingSeconds(timestamp: string): number {
  return Math.max(0, Math.ceil((Date.parse(timestamp) - Date.now()) / 1_000));
}
