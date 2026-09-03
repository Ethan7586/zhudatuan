import { lazy, Suspense } from 'react';
import { useProductViewModel } from '../feature/product/viewmodel/ProductViewModel';

const QuickViewModal = lazy(() => import('../feature/product/view/QuickViewModal').then((module) => ({ default: module.QuickViewModal })));

export function QuickView() {
  const viewmodel = useProductViewModel();
  return (
    <Suspense fallback={null}>
      <QuickViewModal viewmodel={viewmodel} />
    </Suspense>
  );
}
