import { createContext, useContext, type ReactNode } from 'react';
import type { StorefrontSession } from '..';
import type { ToastMessage } from '../../../shared/view/ToastState';
import type { StorefrontQueryIdentity } from '../../../shared/api/Query';

export interface SessionState {
  readonly status: 'checking' | 'guest' | 'authenticated' | 'error';
  readonly session: StorefrontSession | null;
  readonly scope: string;
  readonly query: StorefrontQueryIdentity;
  readonly entry: Readonly<{ handle: string; url: string }>;
  readonly navigation: readonly Readonly<{ id: string; title: string; icon: string; route: string; order: number }>[];
  readonly toasts: readonly ToastMessage[];
  readonly showToast: (text: string, type?: ToastMessage['type']) => void;
  readonly removeToast: (id: string) => void;
  readonly logout: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ value, children }: { readonly value: SessionState; readonly children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SESSION_RUNTIME_MISSING');
  return value;
}
