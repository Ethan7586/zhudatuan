import { Clock3, Store, Truck } from 'lucide-react';
import type { Order } from '../model/Order';
import { formatMinor } from '../../../shared/format/Money';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { orderStatusText, paymentStateText } from '../model/OrderText';

export function OrderCard({ order, open, aftersale }: Readonly<{ order: Order; open: () => void; aftersale: () => void }>) {
  const action = primaryAction(order.status);
  const canRequestAfterSale = ['pending_receipt', 'completed'].includes(order.status);
  return (
    <article data-order-card className="overflow-hidden rounded-2xl border border-edge bg-surface sm:rounded-3xl">
      <header className="flex min-h-12 items-center gap-2 border-b border-edge px-3 py-2.5 sm:px-4">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-light text-brand" aria-hidden="true">
          <Store size={15} strokeWidth={2.4} />
        </span>
        <button type="button" onClick={open} className="min-h-11 min-w-0 flex-1 truncate text-left text-sm font-black text-content hover:text-brand">
          {order.mallName}
        </button>
        <span className="shrink-0 whitespace-nowrap text-sm font-bold text-brand">{orderStatusText(order.status)}</span>
      </header>

      <button type="button" onClick={open} className="block min-h-11 w-full px-3 py-1 text-left sm:px-4" aria-label={`查看${order.mallName}的订单详情`}>
        {order.lines.map((line) => (
          <span key={line.id} className="flex min-w-0 items-center gap-3 border-b border-edge py-3 last:border-b-0">
            <ProductMedia
              source={line.image}
              alt={line.title}
              className="h-20 w-20 shrink-0 rounded-xl bg-subtle object-cover sm:h-24 sm:w-24"
              emptyClassName="grid h-20 w-20 shrink-0 place-items-center whitespace-nowrap rounded-xl bg-subtle px-1 text-center text-[10px] leading-4 text-muted sm:h-24 sm:w-24"
            />
            <span className="min-w-0 flex-1 self-stretch py-0.5">
              <strong className="line-clamp-2 block text-sm leading-5 text-content sm:text-base">{line.title}</strong>
              <span className="mt-1.5 block text-xs text-muted">数量 ×{line.quantity}</span>
              <span className="mt-2 inline-flex max-w-full rounded-md bg-brand-faint px-2 py-1 text-xs font-bold text-brand">{paymentStateText(order.paymentState)}</span>
            </span>
            <strong className="shrink-0 self-center whitespace-nowrap text-base text-danger">¥{formatMinor(line.payableMinor)}</strong>
          </span>
        ))}
      </button>

      <div className="flex items-center gap-2 border-t border-edge px-3 py-3 text-xs text-secondary sm:px-4">
        {order.status === 'pending_receipt' ? <Truck size={16} className="shrink-0 text-brand" aria-hidden="true" /> : <Clock3 size={16} className="shrink-0 text-brand" aria-hidden="true" />}
        <span className="min-w-0 flex-1 leading-5">{progressText(order.status)}</span>
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-edge px-3 py-3 sm:px-4">
        <span className="mr-auto whitespace-nowrap text-sm text-secondary">
          共 {order.lines.reduce((total, line) => total + line.quantity, 0)} 件，实付 <strong className="text-base text-content">¥{formatMinor(order.totalMinor)}</strong>
        </span>
        {canRequestAfterSale ? (
          <button type="button" onClick={aftersale} className="min-h-11 whitespace-nowrap rounded-xl border border-edge-strong px-4 text-sm font-bold text-content hover:border-brand hover:text-brand">
            申请售后
          </button>
        ) : null}
        <button type="button" onClick={action.kind === 'aftersale' ? aftersale : open} className="min-h-11 whitespace-nowrap rounded-xl bg-brand px-4 text-sm font-bold text-inverse hover:bg-brand-dark">
          {action.label}
        </button>
      </footer>
    </article>
  );
}

function primaryAction(status: Order['status']): Readonly<{ kind: 'detail' | 'aftersale'; label: string }> {
  if (status === 'pending_payment') return Object.freeze({ kind: 'detail', label: '继续付款' });
  if (status === 'pending_receipt') return Object.freeze({ kind: 'detail', label: '查看物流' });
  if (status === 'after_sale') return Object.freeze({ kind: 'aftersale', label: '查看售后' });
  return Object.freeze({ kind: 'detail', label: '查看详情' });
}

function progressText(status: Order['status']): string {
  if (status === 'pending_payment') return '完成付款后，商城将开始安排履约';
  if (status === 'pending_shipment') return '商城正在准备商品，可在详情中催发货';
  if (status === 'pending_receipt') return '商品已发出，请留意物流进度';
  if (status === 'after_sale') return '售后服务正在处理，可随时查看最新进度';
  return '订单已完成，如有需要可在服务期内申请售后';
}
