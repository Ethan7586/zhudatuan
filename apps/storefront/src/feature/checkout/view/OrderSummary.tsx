import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import type { CheckoutState } from '../application/CheckoutState';
import { formatMinor } from '../../../shared/format/Money';
import { TenderPanel } from './TenderPanel';

export function OrderSummary({ state, selectedCount, onSubmit }: { readonly state: CheckoutState; readonly selectedCount: number; readonly onSubmit: () => void }) {
  const quote = state.quote;
  const busy = state.phase === 'quoting' || state.phase === 'committing';
  return (
    <aside className="sw-web-checkout-summary sticky top-[100px] space-y-3 rounded-lg border border-edge bg-surface p-3.5 shadow-xs md:col-span-4">
      <h2 className="border-b border-edge pb-2 text-sm font-extrabold text-content">结算汇总与福利支付</h2>
      <TenderPanel quote={quote} />
      <div className="space-y-1.5 border-t border-edge pt-2.5 text-xs text-secondary">
        <div className="flex justify-between">
          <span>商品金额小计</span>
          <b className="text-content">{money(quote?.subtotalMinor)}</b>
        </div>
        <div className="flex justify-between">
          <span>服务端优惠</span>
          <span>{quote ? `-¥${formatMinor(quote.discountMinor)}` : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span>配送费用</span>
          <span>{money(quote?.shippingMinor)}</span>
        </div>
        <div className="flex justify-between">
          <span>税费（已含）</span>
          <span>{money(quote?.taxMinor)}</span>
        </div>
        <div className="flex justify-between border-t border-edge pt-1 text-sm font-bold text-content">
          <span>权威应付金额</span>
          <b className="text-base font-black text-price">{money(quote?.payableMinor)}</b>
        </div>
      </div>
      {quote?.rejections.map((rejection) => (
        <p key={rejection.listing} role="alert" className="rounded bg-warning-surface p-2 text-xs text-warning-strong">
          商品未通过：{rejection.reasons.join('、')}
        </p>
      ))}
      <button
        type="button"
        onClick={onSubmit}
        disabled={selectedCount === 0 || (!state.canQuote && !state.canCommit) || busy}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--sw-brand)] px-3 py-3 text-xs font-extrabold text-inverse shadow-md hover:bg-brand disabled:bg-disabled"
      >
        <Zap className="h-4 w-4 text-warning" />
        {buttonLabel(state, selectedCount)}
        <ArrowRight className="h-4 w-4" />
      </button>
      <div className="flex items-center justify-center gap-1 text-center text-[10px] text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        价格、资格、库存和支付拆分均由服务端重新校验
      </div>
    </aside>
  );
}

function money(value: number | undefined): string {
  return value === undefined ? '服务端报价后显示' : `¥${formatMinor(value)}`;
}

function buttonLabel(state: CheckoutState, selectedCount: number): string {
  if (state.phase === 'quoting') return '正在生成服务端报价…';
  if (state.phase === 'committing') return '正在原子创建订单…';
  if (state.phase === 'quoted') return `核对无误，确认下单（${selectedCount}）`;
  if (state.phase === 'recovered') return '重新生成可确认报价';
  if (state.phase === 'expired') return '报价已过期，重新报价';
  if (state.phase === 'rejected') return '调整后重新报价';
  if (state.phase === 'stale') return '选择已变化，重新报价';
  return `生成服务端报价（${selectedCount}）`;
}
