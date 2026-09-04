import type { ReactNode } from 'react';
import { useSession } from '../entity/session/viewmodel/SessionContext';
import { storefrontAuthHref } from '../config/storefrontAuth';

export function Guard({ children }: { readonly children: ReactNode }) {
  const session = useSession();
  if (session.status === 'checking')
    return (
      <div role="status" className="storefrontloading">
        正在验证商城会话…
      </div>
    );
  if (session.status === 'authenticated') return children;
  window.location.assign(storefrontAuthHref(`${window.location.pathname}${location.search}`));
  return (
    <div role="status" className="storefrontloading">
      正在前往安全登录…
    </div>
  );
}

export function safeReturnTarget(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || /[\r\n\\]/.test(value)) return '/';
  const parsed = new URL(value, window.location.origin);
  return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}` : '/';
}
