import { useCallback, useEffect, useState } from 'react';
import { OTP_POLICY } from './ChallengePolicy';

export function useChallengeCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);
  const start = useCallback((value: number = OTP_POLICY.resendSeconds) => setSeconds(value), []);
  const clear = useCallback(() => setSeconds(0), []);
  return Object.freeze({ seconds, start, clear });
}
