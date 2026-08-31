import type { ReactNode } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';
import { LaptopTopSwitcher } from './Navigation';
import { ToastContainer } from '../shared/ui/ToastContainer';
import { QuickViewModal } from '../feature/product/ui/QuickViewModal';
import { useSession } from '../shared/runtime/SessionContext';
import { routeForPage, useRoutePage } from '../route/Routes';
import { useNavigate } from 'react-router';

export function DesktopShell({ children }: { readonly children: ReactNode }) {
  const { toasts, removeToast } = useSession();
  const page = useRoutePage();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[var(--sw-background)] text-gray-800 flex flex-col font-sans overflow-x-hidden selection:bg-[var(--sw-brand)] selection:text-white">
      <LaptopTopSwitcher />
      <Header activeTab={page} onSelectTab={(next) => void navigate(routeForPage(next))} />
      <main className="flex-1 w-full overflow-x-hidden">{children}</main>
      <QuickViewModal />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Footer />
    </div>
  );
}
