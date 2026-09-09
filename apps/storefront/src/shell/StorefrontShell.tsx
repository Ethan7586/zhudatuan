import type { ReactNode } from 'react';
import type { useShellViewModel } from './ShellViewModel';
import { BottomNavigation } from './BottomNavigation';
import { CompactHeader } from './CompactHeader';
import { CommerceHeader } from './CommerceHeader';
import { QuickView } from './QuickView';
import { ToastContainer } from '../shared/view/ToastContainer';

type ViewModel = ReturnType<typeof useShellViewModel>;

export function StorefrontShell({ viewmodel, children }: Readonly<{ viewmodel: ViewModel; children: ReactNode }>) {
  return (
    <div className="min-h-dvh bg-[var(--sw-background)] pb-16 text-content md:pb-0">
      <a href="#storefront-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-surface focus:p-3">
        跳到主要内容
      </a>
      <CompactHeader viewmodel={viewmodel} />
      <CommerceHeader viewmodel={viewmodel} />
      <main id="storefront-content" tabIndex={-1}>
        {children}
      </main>
      <QuickView enabled={viewmodel.navigation.quickView} />
      <ToastContainer toasts={viewmodel.toasts} removeToast={viewmodel.removeToast} />
      <footer className="mt-8 border-t bg-brand-ink px-4 py-8 text-center text-xs leading-6 text-[var(--sw-inverse-label)]">
        <b className="text-inverse">智慧翼企业福利商城</b>
        <p className="text-inverse-label">价格、库存、资格、订单与权益状态以服务端权威记录为准。</p>
        <p className="text-inverse-label">如需帮助，请进入客服中心；请勿通过非官方渠道提供验证码或密码。</p>
      </footer>
      <BottomNavigation actions={viewmodel.navigation.mobile} pathname={viewmodel.pathname} navigate={viewmodel.actions.navigate} />
    </div>
  );
}
