import { AppBoundary } from '@shop/design';
import { SupplierApp } from './SupplierApp';

export function Providers() {
  return (
    <AppBoundary>
      <SupplierApp />
    </AppBoundary>
  );
}
