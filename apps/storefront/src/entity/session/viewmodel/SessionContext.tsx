import { createContext, useContext, type ReactNode } from 'react';
import type { StorefrontSession } from '..';
import type { ToastMessage } from '../../../shared/view/ToastState';
import type { StorefrontQueryIdentity } from '../../../shared/api/Query';
import type { StorefrontBootstrap } from '../model/Bootstrap';
import type { ExperienceDocument } from '@shop/contract';

export interface SessionState {
  readonly status: 'checking' | 'guest' | 'authenticated' | 'error';
  readonly session: StorefrontSession | null;
  readonly csrfToken: string | null;
  readonly scope: string;
  readonly query: StorefrontQueryIdentity;
  readonly entry: Readonly<{ handle: string; url: string }>;
  readonly navigation: readonly NonNullable<StorefrontBootstrap['navigation']['data']>[number][];
  readonly experience: ExperienceDocument | null;
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
