import { CircleAlert, FileText, LoaderCircle, Package, Truck } from 'lucide-react';
import type { useOrderViewModel } from '../viewmodel/OrderViewModel';
import { formatMinor } from '../../../shared/format/Money';
import { afterSaleStateText, fulfillmentStateText, orderStatusText, paymentStateText } from '../model/OrderText';

export function OrderPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useOrderViewModel> }>) {
  const tabs = [
    { id: 'all', name: '全部订单' },
    { id: 'pending_payment', name: '待付款' },
    { id: 'shipping', name: '配送中' },
    { id: 'completed', name: '已完成' },
    { id: 'after_sale', name: '售后中' },
  ] as const;
  return (
    <div className="min-h-[80dvh] bg-[var(--sw-background)] px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-[1100px]">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">我的订单</h1>
            <p className="mt-1 text-xs text-muted">支付、履约、售后和退款状态均来自订单权威读模型。</p>
          </div>
          <button type="button" onClick={viewmodel.actions.invoices} className="min-h-11 rounded-xl border bg-surface px-4 text-sm font-bold text-brand">
            <FileText size={16} className="mr-2 inline" />
            电子发票
          </button>
        </header>
        <div className="mt-4 flex gap-2 overflow-auto rounded-2xl border bg-surface p-2">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => viewmodel.actions.filter(tab.id)}
              className={`min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-bold ${viewmodel.status === tab.id ? 'bg-brand text-inverse' : 'text-secondary hover:bg-brand-light'}`}
            >
              {tab.name}
            </button>
          ))}
        </div>
        <section className="mt-4 space-y-3">
          {viewmodel.listState === 'loading' ? <ListState icon={<LoaderCircle className="animate-spin" />} text="正在读取权威订单记录…" /> : null}
          {viewmodel.listState === 'failed' ? <ListState icon={<CircleAlert />} text={viewmodel.listError ?? '订单读取失败'} action={<button type="button" onClick={viewmodel.refreshList} className="rounded-xl bg-brand px-4 py-2 font-bold text-inverse">重新读取</button>} /> : null}
          {viewmodel.visibleOrders.map((order) => (
            <article key={order.id} className="overflow-hidden rounded-3xl border border-edge bg-surface shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-subtle px-4 py-3 text-xs">
                <button type="button" onClick={() => viewmodel.actions.open(order.id)} className="font-black text-brand">
                  {order.orderNo}
                </button>
                <span>{new Date(order.createdAt).toLocaleString('zh-CN')}</span>
                <b>{orderStatusText(order.status)}</b>
              </header>
              <button type="button" onClick={() => viewmodel.actions.open(order.id)} className="block w-full p-4 text-left">
                {order.lines.map((line) => (
                  <div key={line.id} className="flex items-center gap-3 py-2">
                    <span className="grid h-14 w-14 place-items-center rounded-xl bg-subtle">
                      <Package className="text-muted" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-bold">{line.title}</h2>
                      <p className="mt-1 text-xs text-muted">
                        数量 {line.quantity} · {paymentStateText(order.paymentState)}
                      </p>
                    </div>
                    <b>¥{formatMinor(line.payableMinor)}</b>
                  </div>
                ))}
              </button>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Truck size={15} />
                  <span>支付：{paymentStateText(order.paymentState)}</span><span>履约：{fulfillmentStateText(order.fulfillmentState)}</span><span>售后：{afterSaleStateText(order.aftersaleState)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <b>实付 ¥{formatMinor(order.totalMinor)}</b>
                  {['pending_receipt', 'completed', 'after_sale'].includes(order.status) ? <button type="button" onClick={() => viewmodel.actions.aftersale(order.id)} className="min-h-11 rounded-xl border px-4 text-xs font-bold">
                    申请/查看售后
                  </button> : null}
                </div>
              </footer>
            </article>
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
  return <div role="status" className="grid min-h-64 place-items-center rounded-3xl border border-dashed bg-surface text-center text-sm text-muted"><div>{icon}<p className="mt-3">{text}</p>{action ? <div className="mt-4">{action}</div> : null}</div></div>;
}
