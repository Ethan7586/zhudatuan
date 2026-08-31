import type { ReactNode } from 'react';
import { TabletNavigation } from './Navigation';
import { ToastContainer } from '../shared/ui/ToastContainer';
import { QuickViewModal } from '../feature/product/ui/QuickViewModal';
import { useSession } from '../shared/runtime/SessionContext';

export function TabletShell({ children }: { readonly children: ReactNode }) {
  const session = useSession();
  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900" data-storefront-channel="tablet">
      <TabletNavigation />
      <main className="min-h-dvh pl-20 pt-16">{children}</main>
      <QuickViewModal />
      <ToastContainer toasts={session.toasts} removeToast={session.removeToast} />
    </div>
  );
}
