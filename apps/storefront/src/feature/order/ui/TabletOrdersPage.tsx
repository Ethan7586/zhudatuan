import { CheckCircle, Clock, FileText, Headphones, Package, Truck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { useOrderRuntime } from '../application/OrderRuntime';

export function TabletOrdersPage({ onAfterSale }: { readonly onAfterSale: (orderId: string) => void }) {
  const { presentationOrders, openFeature } = useOrderRuntime();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const status = search.get('status');
  const visibleOrders = status ? presentationOrders.filter((order) => order.status === status) : presentationOrders;
  return (
    <div className="mx-auto max-w-6xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">订单与账号</h1>
          <p className="text-xs text-slate-500">完整订单状态、福利账户流水与服务入口</p>
        </div>
        <div className="rounded-xl bg-white p-1 shadow-sm">
          <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white">
            我的订单
          </button>
          <button type="button" onClick={() => openFeature('账户')} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-500">
            福利账户
          </button>
        </div>
      </div>
      <Orders />
    </div>
  );

  function Orders() {
    const filters = [
      { label: '全部', icon: FileText },
      { label: '待付款', icon: Clock },
      { label: '待发货', icon: Package },
      { label: '待收货', icon: Truck },
      { label: '已完成', icon: CheckCircle },
      { label: '售后', icon: Headphones },
    ];
    return (
      <>
        <section className="mb-4 grid grid-cols-6 gap-2 rounded-2xl bg-white p-3 shadow-sm">
          {filters.map(({ label, icon: Icon }) => (
            <button
              type="button"
              key={label}
              onClick={() => {
                if (label === '全部') {
                  const next = new URLSearchParams(search);
                  next.delete('status');
                  void setSearch(next);
                } else openFeature(label);
              }}
              className="flex flex-col items-center gap-1 rounded-xl p-2 text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-600"
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </section>
        <section className="space-y-3">
          {visibleOrders.map((order) => (
            <article key={order.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3 text-xs">
                <b>订单号 {order.orderNo}</b>
                <span className="font-bold text-blue-600">{order.statusText}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <img src={order.items[0]?.product.image ?? ''} alt="" className="h-20 w-20 rounded-xl bg-slate-100 object-cover" />
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-sm font-bold">{order.items[0]?.product.title ?? '企业福利订单'}</h2>
                  <p className="mt-2 text-xs text-slate-500">
                    {order.items.length} 件商品 · {order.createTime}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">订单金额</div>
                  <b className="text-lg">¥{order.totalAmount.toFixed(2)}</b>
                </div>
                <div className="space-y-2">
                  <button type="button" onClick={() => void navigate(`/orders/${encodeURIComponent(order.orderId)}`)} className="block w-full rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">
                    订单与物流
                  </button>
                  <button type="button" onClick={() => onAfterSale(order.orderId)} className="block w-full rounded-xl border px-4 py-2 text-xs font-bold">
                    售后与退款
                  </button>
                </div>
              </div>
            </article>
          ))}
          {visibleOrders.length === 0 ? <div className="grid min-h-64 place-items-center rounded-2xl bg-white text-sm text-slate-500">暂无订单记录</div> : null}
        </section>
      </>
    );
  }
}
