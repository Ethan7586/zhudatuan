'use client';

import { ProductionMobileFrame } from './components/mobile/ProductionMobileFrame';
import { H5WechatIdentityBridge } from './components/mobile/H5WechatIdentityBridge';
import { MallProvider } from './context/MallContext';

/** The dedicated consumer H5 entry never renders a desktop storefront. */
export function H5StorefrontRoot() {
  return (
    <MallProvider initialPath="/mini-program">
      <H5WechatIdentityBridge />
      <ProductionMobileFrame />
    </MallProvider>
  );
}
