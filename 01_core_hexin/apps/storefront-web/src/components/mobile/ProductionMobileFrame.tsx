import React from 'react';
import { useMall, type MiniProgramPage } from '../../context/MallContext';
import { MPCartPage } from '../../features/miniprogram/MPCartPage';
import { MPCategoryPage } from '../../features/miniprogram/MPCategoryPage';
import { MPDetailPage } from '../../features/miniprogram/MPDetailPage';
import { MPHomePage } from '../../features/miniprogram/MPHomePage';
import { MPProfilePage } from '../../features/miniprogram/MPProfilePage';
import { MPAddressPage } from '../../features/miniprogram/MPAddressPage';
import { ToastContainer } from '../common/ToastContainer';
import { MobileOrdersPage } from './MobileOrdersPage';
import { PendingInterfaceModal } from './PendingInterfaceModal';
import { PaymentResultPage } from '../common/PaymentResultPage';
import { WeChatTabBar } from './WeChatTabBar';

/** Production phone storefront shown after an L6 consumer opens the mall. */
export function ProductionMobileFrame() {
  const { mpPage, activePaymentId } = useMall();
  const visitedPages = React.useRef(new Set<KeepAlivePage>(['home']));
  const activeKeepAlivePage = !activePaymentId && isKeepAlivePage(mpPage) ? mpPage : null;

  if (activeKeepAlivePage) visitedPages.current.add(activeKeepAlivePage);

  const transientPage = activePaymentId ? <PaymentResultPage paymentId={activePaymentId} /> : renderTransientPage(mpPage);

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
      <PendingInterfaceModal />
      <ToastContainer />
    </div>
  );
}

type KeepAlivePage = Extract<MiniProgramPage, 'home' | 'category' | 'detail' | 'cart' | 'profile'>;

const KEEP_ALIVE_PAGES: readonly KeepAlivePage[] = ['home', 'category', 'detail', 'cart', 'profile'];

function isKeepAlivePage(page: MiniProgramPage): page is KeepAlivePage {
  return KEEP_ALIVE_PAGES.includes(page as KeepAlivePage);
}

function renderKeepAlivePage(page: KeepAlivePage) {
  switch (page) {
    case 'category':
      return <MPCategoryPage />;
    case 'detail':
      return <MPDetailPage />;
    case 'cart':
      return <MPCartPage />;
    case 'profile':
      return <MPProfilePage />;
    default:
      return <MPHomePage />;
  }
}

function renderTransientPage(page: MiniProgramPage) {
  switch (page) {
    case 'orders':
      return <MobileOrdersPage mode="mini-program" />;
    case 'address':
      return <MPAddressPage />;
    default:
      return null;
  }
}
