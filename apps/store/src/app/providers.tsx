import { AppBoundary } from '@shop/design';
import { StoreApp } from './StoreApp';

export function Providers() {
  return (
    <AppBoundary>
      <StoreApp />
    </AppBoundary>
  );
}
