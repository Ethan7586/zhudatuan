'use client';

import { useEffect } from 'react';
import { ProductionMobileFrame } from './components/mobile/ProductionMobileFrame';
import { H5WechatIdentityBridge } from './components/mobile/H5WechatIdentityBridge';
import { MallProvider, useMall } from './context/MallContext';

/** The dedicated consumer H5 entry never renders a desktop storefront. */
export function H5StorefrontRoot() {
  return (
    <MallProvider initialPath="/mini-program">
      <H5DocumentTitle />
      <H5WechatIdentityBridge />
      <ProductionMobileFrame />
    </MallProvider>
  );
}

function H5DocumentTitle() {
  const { currentMall } = useMall();

  useEffect(() => {
    document.title = `${currentMall.mallName}｜消费者商城`;
  }, [currentMall.mallName]);

  return null;
}
