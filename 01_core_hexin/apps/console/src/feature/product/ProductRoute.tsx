import { WorkspacePanelSkeleton } from '@shop/design';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';

const ProductCatalogRoute = lazy(async () => {
  const module = await import('./ProductCatalogRoute');
  return { default: module.ProductCatalogRoute };
});

const ProductSelectionRoute = lazy(async () => {
  const module = await import('./ProductSelectionRoute');
  return { default: module.ProductSelectionRoute };
});

export function Component() {
  const context = useConsoleContext();
  const [search] = useSearchParams();
  const partnerWorkspace = context.scope.kind === 'supplier' || context.scope.kind === 'brand';
  const selectionWorkspace = !partnerWorkspace && search.get('workspace') === 'selection';

  return (
    <Suspense fallback={<WorkspacePanelSkeleton
      label={selectionWorkspace ? '正在准备选品主数据…' : '正在加载商品列表'} cards={8} />}>
      {selectionWorkspace ? <ProductSelectionRoute /> : <ProductCatalogRoute />}
    </Suspense>
  );
}
