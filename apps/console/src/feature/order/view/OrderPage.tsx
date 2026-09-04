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

const OrderDrawer = lazy(() => import('./OrderDrawer').then((module) => ({ default: module.OrderDrawer })));

export function OrderPage({ title, viewmodel }: Readonly<{ title: string; viewmodel: ListViewModel }>) {
  const { actions, aftersale, columns, columnsopen, cursor, detail, error, filter, malls, page, selected, tab, view } = viewmodel;
  return (
    <section className="orderworkspace" aria-labelledby="ordermanagementtitle">
      <OrderPageHeader title={title} isFetching={viewmodel.fetching} onRefresh={actions.refresh} />
      <p className="ordercontractnote" role="note">
        状态、时间、支付、履约和商城条件均由服务端按当前数据范围权威筛选；订单编号支持精确查询。
      </p>
      <OrderStatusTabs active={view} onChange={actions.selectView} />
      <div className="orderfilterarea">
        <OrderFilterForm value={filter} malls={malls} onApply={actions.applyFilter} onColumns={actions.toggleColumns} columnsOpen={columnsopen} />
        <OrderColumnSettings open={columnsopen} visible={columns} onToggle={actions.toggleColumn} onClose={actions.closeColumns} />
        <div className="orderfiltermeta">
          <span>当前条件由服务端实时筛选</span>
        </div>
      </div>
      <div id="orderlistpanel" className="orderlistpanel" aria-busy={viewmodel.fetching}>
        {view === 'aftersale' ? (
          <AfterSalePanel viewmodel={aftersale} selected={selected} onOpen={actions.openAftersale} onRetry={actions.refresh} />
        ) : (
          <>
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
            {page?.items.length === 0 ? (
              <section className="orderliststate" role="status">
                <OrderIcon name="order" />
                <strong>暂无符合条件的订单</strong>
                <p>请调整服务端筛选条件后重试。</p>
              </section>
            ) : null}
            {page === undefined || page.items.length === 0 ? null : <OrderTable rows={page.items} visible={columns} {...(selected === undefined ? {} : { activeOrder: selected })} onOpen={actions.open} />}
          </>
        )}
      </div>
      {view === 'aftersale' ? (
        aftersale.data === undefined ? null : (
          <OrderPagination count={aftersale.data.count} hasCursor={cursor !== undefined} nextCursor={aftersale.data.nextCursor} onCursor={actions.setCursor} />
        )
      ) : page === undefined ? null : (
        <OrderPagination count={page.count} hasCursor={cursor !== undefined} nextCursor={page.nextCursor} onCursor={actions.setCursor} />
      )}
      {selected === undefined ? null : (
        <Suspense fallback={null}>
          <OrderDrawer orderId={selected} tab={tab} viewmodel={detail} onTab={actions.selectTab} onClose={actions.close} />
        </Suspense>
      )}
    </section>
  );
}
