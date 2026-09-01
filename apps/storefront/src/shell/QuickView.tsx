import { lazy, Suspense } from 'react';

const QuickViewModal = lazy(() => import('../feature/product/ui/QuickViewModal').then((module) => ({ default: module.QuickViewModal })));

export function QuickView() {
  return (
    <Suspense fallback={null}>
      <QuickViewModal />
    </Suspense>
  );
}
