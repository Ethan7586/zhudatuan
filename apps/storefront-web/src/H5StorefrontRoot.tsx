'use client';

import { ProductionMobileFrame } from './components/mobile/ProductionMobileFrame';
import { MallProvider } from './context/MallContext';

/** The dedicated consumer H5 entry never renders a desktop storefront. */
export function H5StorefrontRoot() {
  return (
    <MallProvider initialPath="/mini-program">
      <ProductionMobileFrame />
    </MallProvider>
  );
}
