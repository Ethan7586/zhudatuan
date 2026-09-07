import React from 'react';
import { useMall, type MiniProgramPage } from '../../context/MallContext';
import { MPHomePage } from '../../features/miniprogram/MPHomePage';
import { WeChatTabBar } from './WeChatTabBar';
import { loadMPCartPage, loadMPCategoryPage, loadMPDetailPage, loadMPProfilePage, loadMPWelfarePage, preloadPrimaryMiniProgramPages } from './miniProgramPageLoaders';

const MPCartPage = React.lazy(() => loadMPCartPage().then(({ MPCartPage }) => ({ default: MPCartPage })));
const MPCategoryPage = React.lazy(() => loadMPCategoryPage().then(({ MPCategoryPage }) => ({ default: MPCategoryPage })));
const MPDetailPage = React.lazy(() => loadMPDetailPage().then(({ MPDetailPage }) => ({ default: MPDetailPage })));
const MPProfilePage = React.lazy(() => loadMPProfilePage().then(({ MPProfilePage }) => ({ default: MPProfilePage })));
const MPWelfarePage = React.lazy(() => loadMPWelfarePage().then(({ MPWelfarePage }) => ({ default: MPWelfarePage })));
const MPAddressPage = React.lazy(() => import('../../features/miniprogram/MPAddressPage').then(({ MPAddressPage }) => ({ default: MPAddressPage })));
const MobileOrdersPage = React.lazy(() => import('./MobileOrdersPage').then(({ MobileOrdersPage }) => ({ default: MobileOrdersPage })));
const PaymentResultPage = React.lazy(() => import('../common/PaymentResultPage').then(({ PaymentResultPage }) => ({ default: PaymentResultPage })));
const PendingInterfaceModal = React.lazy(() => import('./PendingInterfaceModal').then(({ PendingInterfaceModal }) => ({ default: PendingInterfaceModal })));
const ToastContainer = React.lazy(() => import('../common/ToastContainer').then(({ ToastContainer }) => ({ default: ToastContainer })));

/** Production phone storefront shown after an L6 consumer opens the mall. */
export function ProductionMobileFrame() {
  const { mpPage, activePaymentId, pendingFeature, toasts } = useMall();
  const visitedPages = React.useRef(new Set<KeepAlivePage>(['home']));
  const [warmedPages, setWarmedPages] = React.useState<WarmedPageComponents>({});
  const activeKeepAlivePage = !activePaymentId && isKeepAlivePage(mpPage) ? mpPage : null;

  React.useEffect(() => {
    let cancelled = false;
    const warmPrimaryTabs = () => {
      void preloadPrimaryMiniProgramPages().then(([category, welfare, cart, profile]) => {
        if (cancelled) return;
        setWarmedPages({
          category: category.MPCategoryPage,
          welfare: welfare.MPWelfarePage,
          cart: cart.MPCartPage,
          profile: profile.MPProfilePage,
        });
      });
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
      const handle = idleWindow.requestIdleCallback(warmPrimaryTabs, { timeout: 2_000 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(handle);
      };
    }
    const handle = globalThis.setTimeout(warmPrimaryTabs, 500);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(handle);
    };
  }, []);

  if (activeKeepAlivePage) visitedPages.current.add(activeKeepAlivePage);

  const transientPage = activePaymentId ? deferredPage(<PaymentResultPage paymentId={activePaymentId} />) : renderTransientPage(mpPage);

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
              {renderKeepAlivePage(page, warmedPages)}
            </div>
          ))}
          {activeKeepAlivePage === null ? (
            <div
              data-storefront-mobile-page={activePaymentId ? 'payment-result' : mpPage}
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
type WarmedPage = Extract<KeepAlivePage, 'category' | 'welfare' | 'cart' | 'profile'>;
type WarmedPageComponents = Partial<Record<WarmedPage, React.ComponentType>>;

const KEEP_ALIVE_PAGES: readonly KeepAlivePage[] = ['home', 'category', 'welfare', 'detail', 'cart', 'profile'];

function isKeepAlivePage(page: MiniProgramPage): page is KeepAlivePage {
  return KEEP_ALIVE_PAGES.includes(page as KeepAlivePage);
}

function renderKeepAlivePage(page: KeepAlivePage, warmedPages: WarmedPageComponents) {
  const WarmedPage = page === 'home' || page === 'detail' ? undefined : warmedPages[page];
  if (WarmedPage) return <WarmedPage />;

  switch (page) {
    case 'category':
      return deferredPage(<MPCategoryPage />);
    case 'welfare':
      return deferredPage(<MPWelfarePage />);
    case 'detail':
      return deferredPage(<MPDetailPage />);
    case 'cart':
      return deferredPage(<MPCartPage />);
    case 'profile':
      return deferredPage(<MPProfilePage />);
    default:
      return <MPHomePage />;
  }
}

function renderTransientPage(page: MiniProgramPage) {
  switch (page) {
    case 'orders':
      return deferredPage(<MobileOrdersPage mode="mini-program" />);
    case 'address':
      return deferredPage(<MPAddressPage />);
    default:
      return null;
  }
}

function deferredPage(page: React.ReactNode) {
  return (
    <React.Suspense fallback={<div className="flex min-h-full items-center justify-center bg-[#F5F7FA] text-xs font-medium text-slate-500">页面准备中…</div>}>
      {page}
    </React.Suspense>
  );
}
