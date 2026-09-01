import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { MobileBottomNavigation } from './Navigation';
import { MobileHeader } from './Header';
import { ToastContainer } from '../shared/ui/ToastContainer';
import { useSession } from '../shared/runtime/SessionContext';
import { routeForPage, useRoutePage } from '../route/Routes';
import type { MobileChannel } from '../shared/manifest/StorefrontChannel';
import { QuickView } from './QuickView';

export function MobileShell({ children }: { readonly children: ReactNode }) {
  const navigate = useNavigate();
  const page = useRoutePage();
  const session = useSession();
  const channel: MobileChannel = document.documentElement.dataset.storefrontChannel === 'miniprogram' ? 'miniprogram' : 'android';
  const navigation = { channel, page, onPage: (next: typeof page) => navigate(routeForPage(next)) };
  return (
    <div className={`min-h-dvh bg-slate-50 pb-20 text-slate-900 ${channel === 'miniprogram' ? 'storefrontmini' : 'storefrontandroid'}`} data-storefront-channel={channel}>
      <MobileHeader {...navigation} />
      <main>{children}</main>
      <MobileBottomNavigation {...navigation} />
      <QuickView />
      <ToastContainer toasts={session.toasts} removeToast={session.removeToast} />
    </div>
  );
}
