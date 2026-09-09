import { CircleAlert, FileText, LoaderCircle, RotateCcw } from 'lucide-react';
import type { useOrderViewModel } from '../viewmodel/OrderViewModel';
import { OrderCard } from './OrderCard';
import { OrderStatusTabs } from './OrderStatusTabs';

export function OrderPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useOrderViewModel> }>) {
  return (
    <div className="min-h-[80dvh] bg-[var(--sw-background)] px-3 pb-6 pt-4 sm:px-5 sm:py-6">
      <div className="mx-auto max-w-[980px]">
        <header className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <h1 className="text-2xl font-black">我的订单</h1>
            <p className="mt-1 text-xs leading-5 text-muted">查看付款、发货、收货和售后进度</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={viewmodel.actions.aftersales}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl border border-edge bg-surface px-3 text-sm font-bold text-content hover:border-brand hover:text-brand"
            >
              <RotateCcw size={16} className="mr-1.5" aria-hidden="true" />
              售后订单
            </button>
            <button
              type="button"
              onClick={viewmodel.actions.invoices}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl border border-edge bg-surface px-3 text-sm font-bold text-content hover:border-brand hover:text-brand"
            >
              <FileText size={16} className="mr-1.5" aria-hidden="true" />
              电子发票
            </button>
          </div>
        </header>
        <OrderStatusTabs selected={viewmodel.status} select={viewmodel.actions.filter} />
        <section className="mt-4 space-y-3">
          {viewmodel.listState === 'loading' ? <ListState icon={<LoaderCircle className="animate-spin" />} text="正在读取权威订单记录…" /> : null}
          {viewmodel.listState === 'failed' ? (
            <ListState
              icon={<CircleAlert />}
              text={viewmodel.listError ?? '订单读取失败'}
              action={
                <button type="button" onClick={viewmodel.refreshList} className="rounded-xl bg-brand px-4 py-2 font-bold text-inverse">
                  重新读取
                </button>
              }
            />
          ) : null}
          {viewmodel.visibleOrders.map((order) => (
            <OrderCard key={order.id} order={order} open={() => viewmodel.actions.open(order.id)} aftersale={() => viewmodel.actions.aftersale(order.id)} />
          ))}
          {viewmodel.listState !== 'loading' && viewmodel.listState !== 'failed' && viewmodel.visibleOrders.length === 0 ? (
            <div role="status" className="grid min-h-64 place-items-center rounded-3xl border border-dashed bg-surface text-sm text-muted">
              当前筛选下暂无订单
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function ListState({ icon, text, action }: Readonly<{ icon: React.ReactNode; text: string; action?: React.ReactNode }>) {
  return (
    <div role="status" className="grid min-h-64 place-items-center rounded-3xl border border-dashed bg-surface text-center text-sm text-muted">
      <div>
        {icon}
        <p className="mt-3">{text}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
