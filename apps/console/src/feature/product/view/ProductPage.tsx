import { ResourceState } from '@shop/design';
import type { ProductViewModel } from '../viewmodel/ProductViewModel';
import { PoolDialog } from './PoolDialog';
import { ProductColumnSettings } from './ProductColumnSettings';
import { ProductDialog } from './ProductDialog';
import { ProductDrawer } from './ProductDrawer';
import { ProductFilterForm } from './ProductFilter';
import { ProductHeader } from './ProductHeader';
import { ProductPagination } from './ProductPagination';
import { ProductTable } from './ProductTable';

export function ProductPage({ title, viewmodel }: Readonly<{ title: string; viewmodel: ProductViewModel }>) {
  return (
    <section className="productpage" data-drawer={viewmodel.drawer.listing === undefined ? 'closed' : 'open'}>
      <ProductHeader title={title} onCreate={() => viewmodel.actions.openAction({ kind: 'create' })} onPools={viewmodel.actions.openPools} />
      <section className="productcontrols" aria-label="商品筛选">
        <ProductFilterForm value={viewmodel.filter} onChange={viewmodel.actions.changeFilter} onApply={viewmodel.actions.applyFilter} onReset={viewmodel.actions.resetFilter} onColumns={viewmodel.actions.openColumns} />
        <p className="productservertime">
          <span aria-hidden="true" />
          {viewmodel.resource.condition === 'refreshing' ? '正在同步商品数据…' : '商品数据已加载'}
        </p>
      </section>
      <ResourceState condition={viewmodel.resource.condition} {...(viewmodel.resource.error === undefined ? {} : { error: viewmodel.resource.error })} retry={viewmodel.resource.refresh}>
        <div className="productcatalog">
          {viewmodel.message === undefined ? null : (
            <p role="status" className="productactionmessage">
              {viewmodel.message}
            </p>
          )}
          {viewmodel.batch.error === undefined ? null : (
            <p role="alert" className="productflowerror">
              {viewmodel.batch.error}
            </p>
          )}
          <ProductTable
            rows={viewmodel.rows}
            visibleColumns={viewmodel.columns}
            selected={viewmodel.selected}
            {...(viewmodel.selectedid === undefined ? {} : { activeId: viewmodel.selectedid })}
            onToggle={viewmodel.actions.select}
            onToggleAll={viewmodel.actions.selectPage}
            onOpen={viewmodel.actions.open}
            onBatch={viewmodel.batch.submit}
          />
          <ProductPagination
            count={viewmodel.pagination.count}
            page={viewmodel.page}
            limit={viewmodel.limit}
            canPrevious={viewmodel.pagination.canPrevious}
            canNext={viewmodel.pagination.canNext}
            onPrevious={viewmodel.actions.previous}
            onNext={viewmodel.actions.next}
            onLimit={viewmodel.actions.limit}
          />
        </div>
      </ResourceState>
      <ProductDrawer
        {...(viewmodel.drawer.listing === undefined ? {} : { listing: viewmodel.drawer.listing })}
        tab={viewmodel.drawer.tab}
        {...(viewmodel.drawer.detail === undefined ? {} : { detail: viewmodel.drawer.detail })}
        pending={viewmodel.drawer.pending}
        {...(viewmodel.drawer.error === undefined ? {} : { error: viewmodel.drawer.error })}
        onTab={viewmodel.drawer.selectTab}
        onClose={viewmodel.actions.close}
        onAction={viewmodel.actions.openAction}
      />
      <ProductColumnSettings open={viewmodel.columnsopen} visible={viewmodel.columns} onChange={viewmodel.actions.toggleColumn} onClose={viewmodel.actions.closeColumns} />
      <ProductDialog viewmodel={viewmodel.action} onClose={viewmodel.actions.closeAction} />
      <PoolDialog viewmodel={viewmodel.pool} onClose={viewmodel.actions.closePools} />
    </section>
  );
}
