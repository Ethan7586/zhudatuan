import { Navigate, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useSession } from '../shared/runtime/SessionContext';

export function Guard({ children }: { readonly children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.status === 'checking')
    return (
      <main role="status" className="storefrontloading">
        正在验证商城会话…
      </main>
    );
  if (session.status === 'authenticated') return children;
  const returnTo = safeReturnTarget(`${location.pathname}${location.search}`);
  return <Navigate replace to={`/?returnTo=${encodeURIComponent(returnTo)}`} />;
}

export function safeReturnTarget(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || /[\r\n\\]/.test(value)) return '/';
  const parsed = new URL(value, window.location.origin);
  return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}` : '/';
}
