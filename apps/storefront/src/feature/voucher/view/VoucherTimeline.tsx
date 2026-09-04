import { Clock3, LoaderCircle } from 'lucide-react';
import { chineseReference } from '@shop/presentation';
import type { VoucherActivity } from '../model/VoucherActivity';
import { dateTime, money, reasonLabel, stateLabel } from './VoucherText';

export function VoucherTimeline({ items, state, hasMore, loadingMore, onMore, onRetry, onOpenOrder }: Readonly<{
  items: readonly VoucherActivity[];
  state: 'loading' | 'failed' | 'ready';
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
  onOpenOrder: (order: string) => void;
}>) {
  return <section className="mt-4 rounded-xl border bg-surface p-4 shadow-sm" aria-label="核销记录与卡券动态">
    <h3 className="font-black">核销记录与卡券动态</h3>
    {state === 'loading' ? <p role="status" className="flex items-center justify-center gap-2 py-6 text-muted"><LoaderCircle size={16} className="animate-spin" />正在读取记录…</p> : null}
    {state === 'failed' ? <div role="alert" className="py-4"><p className="text-muted">记录读取失败，卡券余额和详情不受影响。</p><button type="button" onClick={onRetry} className="mt-2 rounded-lg border px-3 py-2 font-bold focus-visible:ring-2 focus-visible:ring-brand">重试记录</button></div> : null}
    {items.map(item => <article key={item.sequence} className="flex gap-3 border-b py-3 last:border-b-0">
      <Clock3 size={15} className="mt-0.5 shrink-0 text-[var(--sw-brand)]" />
      <div className="min-w-0 flex-1">
        <b>{item.redemption ? '卡券核销' : `${stateLabel(item.previous)} → ${stateLabel(item.next)}`}</b>
        <p className="mt-1 text-muted">{reasonLabel(item.reason)} · {dateTime(item.occurredAt)}</p>
        {item.redemption ? <div className="mt-2 rounded-lg bg-brand-light/30 p-3">
          <p className="font-bold">核销 {money(item.redemption.amountMinor, item.redemption.currency)}</p>
          <p className="mt-1 text-muted">{({ succeeded: '核销成功', partiallyrefunded: '部分退款', refunded: '已全额退款' })[item.redemption.state]} · 已退款 {money(item.redemption.refundedMinor, item.redemption.currency)}</p>
          {item.redemption.order ? <button type="button" onClick={() => onOpenOrder(item.redemption!.order!)} className="mt-2 inline-block font-bold text-brand-dark underline focus-visible:ring-2 focus-visible:ring-brand">查看{chineseReference('订单', item.redemption.order)}</button> : null}
        </div> : null}
      </div>
    </article>)}
    {state === 'ready' && items.length === 0 ? <p className="py-6 text-center text-muted">暂无核销或状态动态</p> : null}
    {hasMore ? <button type="button" onClick={onMore} disabled={loadingMore} className="mt-3 w-full rounded-lg border px-3 py-3 font-bold disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand">{loadingMore ? '正在加载…' : '加载更多记录'}</button> : null}
  </section>;
}
