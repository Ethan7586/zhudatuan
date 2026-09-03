import { useCallback, useEffect, useState } from 'react';

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
