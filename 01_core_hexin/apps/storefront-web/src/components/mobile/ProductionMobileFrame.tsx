import React from 'react';
import { useMall } from '../../context/MallContext';
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

/** Production phone storefront shown after an L6 consumer opens the mall. */
export function ProductionMobileFrame() {
  const { mpPage, activePaymentId } = useMall();

  const page = activePaymentId ? <PaymentResultPage paymentId={activePaymentId} /> : (() => {
    switch (mpPage) {
      case 'category':
        return <MPCategoryPage />;
      case 'detail':
        return <MPDetailPage />;
      case 'cart':
        return <MPCartPage />;
      case 'orders':
        return <MobileOrdersPage mode="mini-program" />;
      case 'profile':
        return <MPProfilePage />;
      case 'address':
        return <MPAddressPage />;
      default:
        return <MPHomePage />;
    }
  })();

  return (
    <div data-storefront-surface="h5" className="min-h-[100dvh] bg-[#F5F7FA] text-gray-800">
      <div className="mx-auto min-h-[100dvh] max-w-[430px] overflow-x-hidden bg-[#F5F7FA] shadow-xl">{page}</div>
      <PendingInterfaceModal />
      <ToastContainer />
    </div>
  );
}
