import { lazy, Suspense } from 'react';
import { useProductViewModel } from '../feature/product/viewmodel/ProductViewModel';

const QuickViewModal = lazy(() => import('../feature/product/view/QuickViewModal').then((module) => ({ default: module.QuickViewModal })));

export function QuickView({ enabled }: Readonly<{ enabled: boolean }>) {
  return enabled ? <EnabledQuickView /> : null;
}

function EnabledQuickView() {
  const viewmodel = useProductViewModel();
  return (
    <Suspense fallback={null}>
      <QuickViewModal viewmodel={viewmodel} />
    </Suspense>
  );
}
