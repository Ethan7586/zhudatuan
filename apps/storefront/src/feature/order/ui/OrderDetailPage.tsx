import { ArrowLeft, BellRing, CheckCircle2, Clock3, PackageCheck, Truck } from 'lucide-react';
import { chineseProviderLabel, chineseReference } from '@shop/presentation';
import { useNavigate, useParams } from 'react-router';
import { useState } from 'react';
import { useOrderRuntime } from '../application/OrderRuntime';
import { formatMinor } from '../../../shared/format/Money';
import { fulfillmentStateText, orderStatusText, timelineStateText } from '../model/OrderText';

export function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { orders, receiveOrder, remindOrder, showToast } = useOrderRuntime();
  const [pending, setPending] = useState<'receive' | 'remind' | null>(null);
  const order = orders.find(({ id }) => id === orderId);
  if (!order)
    return (
      <main className="mx-auto grid min-h-[60dvh] max-w-5xl place-items-center p-6 text-sm text-slate-500" role="status">
        正在安全加载订单详情…
      </main>
    );
  const act = async (kind: 'receive' | 'remind') => {
    setPending(kind);
    try {
      if (kind === 'receive') await receiveOrder(order.id, order.version);
      else await remindOrder(order.id);
      if (kind === 'receive') showToast('订单已确认收货', 'success');
    } catch {
      showToast(kind === 'receive' ? '确认收货失败，请刷新订单后重试' : '催发货过于频繁或当前状态不允许', 'error');
    } finally {
      setPending(null);
    }
  };
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <button type="button" onClick={() => void navigate('/orders')} className="flex items-center gap-1 text-sm font-bold text-blue-700">
        <ArrowLeft size={16} />
        返回我的订单
      </button>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <h1 className="text-lg font-black">订单详情</h1>
            <p className="mt-1 text-xs text-slate-500">订单号 {order.orderNo}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{orderStatusText(order.status)}</span>
        </div>
        <div className="mt-4 space-y-3">
          {order.lines.map((line) => (
            <article key={line.id} className="flex items-center gap-3 rounded-xl border p-3">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-slate-100">
                <PackageCheck className="text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-bold">{line.title}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {chineseReference('商品规格', line.skuId)} × {line.quantity}
                </p>
                {line.partner || line.provider ? <p className="mt-1 text-xs text-slate-500">履约方：{line.provider ? chineseProviderLabel(line.provider) : chineseReference('合作方', line.partner)}</p> : null}
              </div>
              <b className="text-sm">¥{formatMinor(line.payableMinor)}</b>
            </article>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <span className="text-sm text-slate-500">订单实付</span>
          <b className="text-xl text-red-500">¥{formatMinor(order.totalMinor)}</b>
        </div>
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-black">
          <Truck size={18} className="text-blue-600" />
          物流时间线
        </h2>
        {order.timeline.length ? (
          <ol className="mt-4 space-y-4 border-l-2 border-blue-100 pl-5">
            {order.timeline.map((item) => (
              <li key={item.id} className="relative">
                <CheckCircle2 className="absolute -left-[30px] top-0 bg-white text-blue-600" size={18} />
                <b className="text-sm">{timelineStateText(item.state)}</b>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(item.occurredAt).toLocaleString('zh-CN')}
                  {item.tracking ? ` · ${item.tracking}` : ''}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            <Clock3 size={17} />
            暂无物流节点，当前为“{fulfillmentStateText(order.fulfillmentState)}”
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {['paid', 'fulfilling'].includes(order.lifecycleState) ? (
            <button type="button" disabled={pending !== null} onClick={() => void act('remind')} className="flex items-center gap-1 rounded-xl border px-4 py-2 text-xs font-bold text-blue-700 disabled:opacity-50">
              <BellRing size={15} />
              {pending === 'remind' ? '提交中…' : '催发货'}
            </button>
          ) : null}
          {order.status === 'pending_receipt' ? (
            <button type="button" disabled={pending !== null} onClick={() => void act('receive')} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:bg-slate-300">
              {pending === 'receive' ? '确认中…' : '确认收货'}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
