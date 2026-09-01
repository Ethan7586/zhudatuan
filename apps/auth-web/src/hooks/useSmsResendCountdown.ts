import { useCallback, useEffect, useState } from 'react';
import {
  SMS_CODE_RESEND_SECONDS,
  smsResendDeadline,
  smsResendSecondsRemaining,
} from '../services/otpPolicy';

export function useSmsResendCountdown() {
  const [deadlineMs, setDeadlineMs] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (deadlineMs <= 0) {
      setSeconds(0);
      return;
    }
    const refresh = () => {
      const remaining = smsResendSecondsRemaining(deadlineMs, Date.now());
      setSeconds(remaining);
      if (remaining === 0) setDeadlineMs(0);
    };
    refresh();
    const timer = window.setInterval(refresh, 250);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [deadlineMs]);

  const start = useCallback((requestedSeconds: number = SMS_CODE_RESEND_SECONDS) => {
    const now = Date.now();
    const deadline = smsResendDeadline(now, requestedSeconds);
    setDeadlineMs(deadline);
    setSeconds(smsResendSecondsRemaining(deadline, now));
  }, []);

  const reset = useCallback(() => {
    setDeadlineMs(0);
    setSeconds(0);
  }, []);

  return Object.freeze({ seconds, start, reset });
}
