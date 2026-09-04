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
