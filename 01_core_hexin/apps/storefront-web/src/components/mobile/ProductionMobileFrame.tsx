import React from 'react';
import { PaymentExperienceBoundary, PaymentStableCarrier } from '../common/PaymentExperienceBoundary';
import { useMall, type MiniProgramPage } from '../../context/MallContext';
import { MPHomePage } from '../../features/miniprogram/MPHomePage';
import { WeChatTabBar } from './WeChatTabBar';
import { loadMobileOrdersPage, loadMPAddressPage, loadMPCartPage, loadMPCategoryPage, loadMPDetailPage, loadMPProfilePage, loadMPWelfarePage, loadPaymentResultPage } from './miniProgramPageLoaders';

const MPCartPage = React.lazy(() => loadMPCartPage().then(({ MPCartPage }) => ({ default: MPCartPage })));
const MPCategoryPage = React.lazy(() => loadMPCategoryPage().then(({ MPCategoryPage }) => ({ default: MPCategoryPage })));
const MPDetailPage = React.lazy(() => loadMPDetailPage().then(({ MPDetailPage }) => ({ default: MPDetailPage })));
const MPProfilePage = React.lazy(() => loadMPProfilePage().then(({ MPProfilePage }) => ({ default: MPProfilePage })));
const MPWelfarePage = React.lazy(() => loadMPWelfarePage().then(({ MPWelfarePage }) => ({ default: MPWelfarePage })));
const MPAddressPage = React.lazy(() => loadMPAddressPage().then(({ MPAddressPage }) => ({ default: MPAddressPage })));
const MobileOrdersPage = React.lazy(() => loadMobileOrdersPage().then(({ MobileOrdersPage }) => ({ default: MobileOrdersPage })));
const PaymentResultPage = React.lazy(() => loadPaymentResultPage().then(({ PaymentResultPage }) => ({ default: PaymentResultPage })));
const PendingInterfaceModal = React.lazy(() => import('./PendingInterfaceModal').then(({ PendingInterfaceModal }) => ({ default: PendingInterfaceModal })));
const ToastContainer = React.lazy(() => import('../common/ToastContainer').then(({ ToastContainer }) => ({ default: ToastContainer })));

/** Production phone storefront shown after an L6 consumer opens the mall. */
export function ProductionMobileFrame() {
  const {
    mpPage, activePaymentId, activePaymentSession, closePaymentResult, navigateTo, pendingFeature,
    setAndroidPage, setLaptopPage, setMpPage, setTabletPage, toasts,
  } = useMall();
  const visitedPages = React.useRef(new Set<KeepAlivePage>(['home']));
  const activeKeepAlivePage = !activePaymentSession && isKeepAlivePage(mpPage) ? mpPage : null;

  React.useEffect(() => {
    const warmCart = () => {
      void loadMPCartPage();
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
      const handle = idleWindow.requestIdleCallback(warmCart, { timeout: 2_000 });
      return () => {
        idleWindow.cancelIdleCallback?.(handle);
      };
    }
    const handle = globalThis.setTimeout(warmCart, 500);
    return () => {
      globalThis.clearTimeout(handle);
    };
  }, []);

  React.useEffect(() => {
    if (mpPage === 'profile') void loadMobileOrdersPage();
  }, [mpPage]);

  if (activeKeepAlivePage) visitedPages.current.add(activeKeepAlivePage);

  const viewPaymentOrder = React.useCallback(() => {
    setMpPage('orders');
    setAndroidPage('orders');
    setTabletPage('orders');
    setLaptopPage('orders');
    navigateTo('orders');
    closePaymentResult();
  }, [closePaymentResult, navigateTo, setAndroidPage, setLaptopPage, setMpPage, setTabletPage]);
  const recoverPayment = React.useCallback(() => window.location.reload(), []);
  const transientPage = activePaymentSession ? (
    <PaymentExperienceBoundary
      paymentId={activePaymentId ?? activePaymentSession.idempotencyKey}
      onRecover={recoverPayment}
      onViewOrders={viewPaymentOrder}
    >
      <React.Suspense fallback={<PaymentStableCarrier session={activePaymentSession} />}>
        <PaymentResultPage session={activePaymentSession} />
      </React.Suspense>
    </PaymentExperienceBoundary>
  ) : renderTransientPage(mpPage);

  return (
    <div data-storefront-surface="h5" className="h-[100dvh] overflow-hidden bg-[#F5F7FA] text-gray-800">
      <div className="mx-auto flex h-[100dvh] max-w-[430px] flex-col overflow-hidden bg-[#F5F7FA] shadow-xl">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {[...visitedPages.current].map((page) => (
            <div
              key={page}
              data-storefront-mobile-page={page}
              data-storefront-mobile-scroll
              data-active={activeKeepAlivePage === page ? 'true' : 'false'}
              aria-hidden={activeKeepAlivePage !== page}
              className={`absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch] ${activeKeepAlivePage === page ? 'visible z-10' : 'invisible pointer-events-none z-0'}`}
            >
              {renderKeepAlivePage(page)}
            </div>
          ))}
          {activeKeepAlivePage === null ? (
            <div
              data-storefront-mobile-page={activePaymentSession ? 'payment-result' : mpPage}
              data-storefront-mobile-scroll
              className="h-full overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
            >
              {transientPage}
            </div>
          ) : null}
        </div>
        <WeChatTabBar />
      </div>
      {pendingFeature.isOpen ? <React.Suspense fallback={null}><PendingInterfaceModal /></React.Suspense> : null}
      {toasts.length > 0 ? <React.Suspense fallback={null}><ToastContainer /></React.Suspense> : null}
    </div>
  );
}

type KeepAlivePage = Extract<MiniProgramPage, 'home' | 'category' | 'welfare' | 'detail' | 'cart' | 'profile'>;

const KEEP_ALIVE_PAGES: readonly KeepAlivePage[] = ['home', 'category', 'welfare', 'detail', 'cart', 'profile'];

function isKeepAlivePage(page: MiniProgramPage): page is KeepAlivePage {
  return KEEP_ALIVE_PAGES.includes(page as KeepAlivePage);
}

function renderKeepAlivePage(page: KeepAlivePage) {
  switch (page) {
    case 'category':
      return deferredPage(<MPCategoryPage />);
    case 'welfare':
      return deferredPage(<MPWelfarePage />);
    case 'detail':
      return deferredPage(<MPDetailPage />);
    case 'cart':
      return deferredPage(<MPCartPage />, <MobileOrdersEntryShell />);
    case 'profile':
      return deferredPage(<MPProfilePage />);
    default:
      return <MPHomePage />;
  }
}

function renderTransientPage(page: MiniProgramPage) {
  switch (page) {
    case 'orders':
      return deferredPage(<MobileOrdersPage mode="mini-program" />, <MobileOrdersEntryShell />);
    case 'address':
      return deferredPage(<MPAddressPage />);
    default:
      return null;
  }
}

function deferredPage(page: React.ReactNode, fallback: React.ReactNode = <div className="flex min-h-full items-center justify-center bg-[#F5F7FA] text-xs font-medium text-slate-500">页面准备中…</div>) {
  return (
    <React.Suspense fallback={fallback}>
      {page}
    </React.Suspense>
  );
}

function MobileOrdersEntryShell() {
  return (
    <div aria-label="订单页面正在准备" className="min-h-full bg-[#F5F7FA] text-gray-800">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-3 py-3">
        <span className="h-8 w-8 rounded-full bg-slate-100" />
        <div className="space-y-1.5"><span className="block h-3 w-16 rounded-full bg-slate-200" /><span className="block h-2 w-32 rounded-full bg-slate-100" /></div>
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-5 gap-1 rounded-2xl bg-white p-1.5">
          {Array.from({ length: 5 }, (_, index) => <span key={index} className="h-9 rounded-xl bg-slate-100" />)}
        </div>
        <div className="rounded-3xl bg-white p-3.5">
          <div className="flex gap-3"><span className="h-14 w-14 rounded-xl bg-slate-100" /><div className="flex-1 space-y-2"><span className="block h-3 w-3/4 rounded-full bg-slate-200" /><span className="block h-2 w-1/2 rounded-full bg-slate-100" /></div></div>
        </div>
      </div>
    </div>
  );
}
