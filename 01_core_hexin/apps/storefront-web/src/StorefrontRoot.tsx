'use client';

import { StorefrontWebFrame } from './components/laptop/LaptopFrame';
import { ProductionMobileFrame } from './components/mobile/ProductionMobileFrame';
import { MallProvider, useMall } from './context/MallContext';

function ProductionStorefrontFrame() {
  const { appMode } = useMall();
  const surface = appMode === 'pc' ? 'desktop-1920' : 'laptop';

  return (
    <>
      <div className="md:hidden">
        <ProductionMobileFrame />
      </div>
      <div className="hidden md:block">
        <StorefrontWebFrame surface={surface} navigationBoundary="production" />
      </div>
    </>
  );
}

/**
 * The only production consumer-Web entry.
 *
 * It uses the approved smart-wing-storefront-web-v1 component tree while
 * keeping production data authoritative. Demo data remains isolated behind
 * the explicit device-preview routes.
 */
export function StorefrontRoot() {
  return (
    <MallProvider initialPath="/desktop-1920">
      <ProductionStorefrontFrame />
    </MallProvider>
  );
}
