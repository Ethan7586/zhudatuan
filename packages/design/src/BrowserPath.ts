import { useCallback, useEffect, useState } from 'react';

export interface BrowserPath {
  readonly pathname: string;
  readonly entry: string;
  readonly navigate: (pathname: string, replace?: boolean) => void;
}

export function useBrowserPath(): BrowserPath {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const synchronize = () => setLocation(readLocation());
    window.addEventListener('popstate', synchronize);
    return () => window.removeEventListener('popstate', synchronize);
  }, []);
  const navigate = useCallback((path: string, replace = false) => {
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) throw new Error('BROWSER_PATH_INVALID');
    const entry = createEntry();
    window.history[replace ? 'replaceState' : 'pushState'](historyState(entry), '', path);
    setLocation({ pathname: window.location.pathname, entry });
  }, []);
  return Object.freeze({ ...location, navigate });
}

const stateKey = 'shopRouteEntry';
let sequence = 0;

function readLocation(): Readonly<{ pathname: string; entry: string }> {
  const existing = historyEntry();
  if (existing !== undefined) return Object.freeze({ pathname: window.location.pathname, entry: existing });
  const entry = createEntry();
  window.history.replaceState(historyState(entry), '', window.location.href);
  return Object.freeze({ pathname: window.location.pathname, entry });
}

function historyEntry(): string | undefined {
  const state = window.history.state;
  if (typeof state !== 'object' || state === null) return undefined;
  const value = Reflect.get(state, stateKey);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function historyState(entry: string): Readonly<Record<string, unknown>> {
  const current = typeof window.history.state === 'object' && window.history.state !== null ? window.history.state as Record<string, unknown> : {};
  return Object.freeze({ ...current, [stateKey]: entry });
}

function createEntry(): string {
  sequence += 1;
  return `route:${Date.now().toString(36)}:${sequence.toString(36)}`;
}
