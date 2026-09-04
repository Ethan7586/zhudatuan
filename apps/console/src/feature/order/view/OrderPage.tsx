import { lazy, Suspense } from 'react';
import type { ListViewModel } from '../viewmodel/ListViewModel';
import { AfterSalePanel } from './AfterSalePanel';
import { OrderColumnSettings } from './OrderColumnSettings';
import { OrderFilterForm } from './OrderFilter';
import { OrderIcon } from './OrderIcon';
import { OrderPageHeader } from './OrderPageHeader';
import { OrderPagination } from './OrderPagination';
import { OrderStatusTabs } from './OrderStatusTabs';
import { OrderTable } from './OrderTable';
import { OrderImportDialog } from './OrderImportDialog';
import { OrderExportDialog } from './OrderExportDialog';
import { AfterSaleDecisionDialog } from './AfterSaleDecisionDialog';
import { AfterSaleReturnDialog } from './AfterSaleReturnDialog';
import { OrderExceptionPanel } from './OrderExceptionPanel';
import { formatOrderTime } from './OrderPresentation';

const OrderDrawer = lazy(() => import('./OrderDrawer').then((module) => ({ default: module.OrderDrawer })));

export function OrderPage({ title, viewmodel }: Readonly<{ title: string; viewmodel: ListViewModel }>) {
  const { actions, aftersale, columns, columnsopen, detail, error, filter, malls, page, pageindex, pagination, selected, tab, view } = viewmodel;
  return (
    <section className="orderworkspace" aria-labelledby="ordermanagementtitle">
      <OrderPageHeader title={title} isFetching={viewmodel.fetching} onRefresh={actions.refresh} canImport={viewmodel.canImport} canExport={viewmodel.canExport} onImport={actions.openImport} onExport={actions.openExport} />
      <p className="ordercontractnote" role="note">
        状态、时间、支付、履约和商城条件均由服务端按当前数据范围权威筛选；订单编号支持精确查询。
      </p>
      <OrderStatusTabs active={view} facets={page?.facets} onChange={actions.selectView} />
      <div className="orderfilterarea">
        <details className="orderfilterdisclosure">
          <summary><span>筛选与查找</span><small>{activeFilterCount(filter) === 0 ? '按订单、状态、商城或更多条件查找' : `已启用 ${activeFilterCount(filter)} 个条件`}</small></summary>
          <OrderFilterForm value={filter} malls={malls} onApply={actions.applyFilter} onColumns={actions.toggleColumns} columnsOpen={columnsopen} />
        </details>
        <OrderColumnSettings open={columnsopen} visible={columns} onToggle={actions.toggleColumn} onClose={actions.closeColumns} />
        <div className="orderfiltermeta">
          <span>当前条件由服务端实时筛选</span>
          {page?.facets.state === 'ready' ? <span>订单水位 {page.facets.data.watermarks.order ? formatOrderTime(page.facets.data.watermarks.order) : '暂无数据'}</span> : null}
        </div>
      </div>
      <div id="orderlistpanel" className="orderlistpanel" aria-busy={viewmodel.fetching}>
        {view === 'aftersale' ? (
          <AfterSalePanel viewmodel={aftersale} selected={selected} onOpen={actions.openAftersale} onRetry={actions.refresh} />
        ) : (
          <>
            {page?.facets.state === 'unavailable' ? <section className="orderfacetnotice" role="status"><span>{page.facets.error.message}</span><button type="button" onClick={actions.refresh}>重试统计</button></section> : null}
            {page?.facets.state === 'ready' && page.facets.data.counts.exception > 0 && view !== 'exception' ? <section className="orderfacetnotice iswarning" role="status"><span>发现 {page.facets.data.counts.exception} 条支付、履约、售后或来源核验异常。</span><button type="button" onClick={() => actions.selectView('exception')}>优先处理异常</button></section> : null}
            {viewmodel.pending ? (
              <p className="orderliststate" role="status">
                正在读取订单…
              </p>
            ) : null}
            {viewmodel.failed && page === undefined ? (
              <section className="orderliststate" role="alert">
                <strong>订单读取失败</strong>
                <p>{error}</p>
                <button type="button" onClick={actions.refresh}>
                  重试
                </button>
              </section>
            ) : null}
            {viewmodel.failed && page !== undefined ? (
              <p className="orderstalebanner" role="status">
                刷新失败，当前保留最近一次已验证数据：{error}
              </p>
            ) : null}
            {page?.items.length === 0 && view !== 'exception' ? (
              <section className="orderliststate" role="status">
                <OrderIcon name="order" />
                <strong>暂无符合条件的订单</strong>
                <p>请调整服务端筛选条件后重试。</p>
              </section>
            ) : null}
            {page === undefined ? null : view === 'exception' ? <OrderExceptionPanel rows={page.items} recoveries={viewmodel.recoveries} onOpen={actions.open} onRetry={actions.refresh} /> : page.items.length === 0 ? null : <OrderTable rows={page.items} visible={columns} {...(selected === undefined ? {} : { activeOrder: selected })} onOpen={actions.open} />}
          </>
        )}
      </div>
      {view === 'aftersale' ? (
        aftersale.data === undefined ? null : (
          <OrderPagination count={aftersale.data.count} page={pageindex} {...pagination} onFirst={actions.first} onPrevious={actions.previous} onNext={actions.next} />
        )
      ) : page === undefined ? null : (
        <OrderPagination count={page.count} page={pageindex} {...pagination} onFirst={actions.first} onPrevious={actions.previous} onNext={actions.next} />
      )}
      {selected === undefined ? null : (
        <Suspense fallback={null}>
          <OrderDrawer orderId={selected} tab={tab} viewmodel={detail} onTab={actions.selectTab} onDetail={() => actions.openDetail(selected)} onClose={actions.close} />
        </Suspense>
      )}
      <OrderImportDialog model={viewmodel} />
      <OrderExportDialog model={viewmodel} />
      <AfterSaleDecisionDialog model={aftersale} />
      <AfterSaleReturnDialog model={aftersale} />
    </section>
  );
}

function activeFilterCount(filter: ListViewModel['filter']): number {
  return Object.values(filter).filter((value) => value !== '').length;
}
