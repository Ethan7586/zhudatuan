import { WorkspacePage } from '@shop/design';
import type { ProductViewModel } from '../viewmodel/ProductViewModel';
import { OP_CATALOG_PRODUCTS_CREATE } from '@shop/contract/ids';
import type { ProductImportViewModel } from '../viewmodel/ProductImportViewModel';
import type { ProductStockViewModel } from '../viewmodel/ProductStockViewModel';
import { PoolDialog } from './PoolDialog';
import { ProductColumnSettings } from './ProductColumnSettings';
import { ProductDialog } from './ProductDialog';
import { ProductDrawer } from './ProductDrawer';
import { ProductFilterForm } from './ProductFilter';
import { ProductHeader } from './ProductHeader';
import { ProductPagination } from './ProductPagination';
import { ProductTable } from './ProductTable';
import { ProductImportDialog } from './ProductImportDialog';
import { ProductBatchDialog } from './ProductBatchDialog';
import { FilterDisclosure } from './FilterDisclosure';
import { presentProductStatus } from './ProductStatus';
import { ProductStockDialog } from './ProductStockDialog';

export function ProductPage({ title, viewmodel, importmodel, stockmodel }: Readonly<{ title: string; viewmodel: ProductViewModel; importmodel: ProductImportViewModel; stockmodel: ProductStockViewModel }>) {
  const drawerOpen = viewmodel.drawer.listing !== undefined && viewmodel.action.action === null;
  return (
    <WorkspacePage
      label="商品治理台"
      className="productpage"
      drawerOpen={drawerOpen}
      header={
        <ProductHeader
          title={title}
          onCreate={() => viewmodel.actions.openAction({ operation: OP_CATALOG_PRODUCTS_CREATE })}
          onPools={() => viewmodel.actions.openPools()}
          onImport={importmodel.actions.open}
          canCreate={viewmodel.access.canCreate}
          {...(viewmodel.access.createReason === undefined ? {} : { createReason: viewmodel.access.createReason })}
          canPools={viewmodel.access.canManagePools}
          {...(viewmodel.access.poolReason === undefined ? {} : { poolReason: viewmodel.access.poolReason })}
          canImport={importmodel.canOpen}
          {...(importmodel.permissionReason === undefined ? {} : { importReason: importmodel.permissionReason })}
        />
      }
      controls={
        <section className="productcontrols" aria-label="商品筛选">
          <FilterDisclosure count={activeFilterCount(viewmodel.filter)}>
            <ProductFilterForm
              value={viewmodel.filter}
              onChange={viewmodel.actions.changeFilter}
              onApply={viewmodel.actions.applyFilter}
              onReset={viewmodel.actions.resetFilter}
              onColumns={viewmodel.actions.openColumns}
              {...(viewmodel.facets.data === undefined ? {} : { facets: viewmodel.facets.data })}
              facetsLoading={viewmodel.facets.loading}
              {...(viewmodel.facets.error === undefined ? {} : { facetsError: viewmodel.facets.error })}
              onRetryFacets={viewmodel.facets.retry}
            />
          </FilterDisclosure>
          <p className="productservertime" data-condition={viewmodel.resource.condition} role="status" aria-live="polite">
            <span aria-hidden="true" />
            {presentProductStatus(viewmodel.resource.condition)}
          </p>
        </section>
      }
      condition={viewmodel.resource.condition}
      {...(viewmodel.resource.error === undefined ? {} : { error: viewmodel.resource.error })}
      retry={viewmodel.resource.refresh}
      emptyTitle="暂无商品"
      emptyMessage="当前范围没有符合条件的商品，可调整筛选或新建商品。"
      layers={
        <>
          <ProductDrawer
            {...(!drawerOpen || viewmodel.drawer.listing === undefined ? {} : { listing: viewmodel.drawer.listing })}
            tab={viewmodel.drawer.tab}
            {...(viewmodel.drawer.detail === undefined ? {} : { detail: viewmodel.drawer.detail })}
            sections={viewmodel.drawer.sections}
            onTab={viewmodel.drawer.selectTab}
            onClose={viewmodel.actions.close}
            onDetail={viewmodel.actions.openDetail}
            onAction={viewmodel.actions.openAction}
            onPool={viewmodel.actions.openPools}
            onInventory={stockmodel.actions.open}
            onQualification={viewmodel.actions.openQualification}
            canUse={viewmodel.access.canOperation}
          />
          <ProductColumnSettings open={viewmodel.columnsopen} visible={viewmodel.columns} onChange={viewmodel.actions.toggleColumn} onClose={viewmodel.actions.closeColumns} />
          <ProductDialog viewmodel={viewmodel.action} onClose={viewmodel.actions.closeAction} />
          <PoolDialog viewmodel={viewmodel.pool} onClose={viewmodel.actions.closePools} />
          <ProductImportDialog viewmodel={importmodel} />
          <ProductBatchDialog viewmodel={viewmodel.batch} />
          <ProductStockDialog viewmodel={stockmodel} />
        </>
      }
    >
      <div className="productcatalog">
        {viewmodel.message === undefined ? null : (
          <p role="status" className="productactionmessage">
            {viewmodel.message}
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
          onBatch={viewmodel.actions.openBatch}
          canBatch={viewmodel.batch.allowed}
          {...(viewmodel.batch.permissionReason === undefined ? {} : { batchReason: viewmodel.batch.permissionReason })}
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
    </WorkspacePage>
  );
}

function activeFilterCount(filter: ProductViewModel['filter']): number {
  return [filter.q, filter.category, filter.supplier, filter.mall, filter.status].filter((value) => value !== '').length;
}
