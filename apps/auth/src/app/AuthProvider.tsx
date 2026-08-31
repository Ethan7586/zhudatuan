import type { AuthTarget } from '@shop/config/client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { authTargetSearch, readAuthRequest, type AuthRequest } from '../shared/returntarget/ReturnTarget';

interface AuthDependencies {
  readonly request: AuthRequest;
  readonly selectTarget: (target: AuthTarget) => void;
}

const AuthContext = createContext<AuthDependencies | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [request, setRequest] = useState<AuthRequest>(() => readAuthRequest(window.location));
  const selectTarget = useCallback((target: AuthTarget) => {
    setRequest((current) => {
      if (current.target === target) return current;
      const search = authTargetSearch(window.location.search, target);
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}`);
      return Object.freeze({ target });
    });
  }, []);
  const value = useMemo<AuthDependencies>(() => Object.freeze({ request, selectTarget }), [request, selectTarget]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthDependencies {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('AUTH_PROVIDER_REQUIRED');
  return value;
}
