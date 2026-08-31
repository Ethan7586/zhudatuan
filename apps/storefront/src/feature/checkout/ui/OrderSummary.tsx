import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import type { Quote } from '../model/Quote';
import { formatMinor } from '../../../shared/format/Money';
import { TenderPanel } from './TenderPanel';

export function OrderSummary({
  quote,
  estimateMinor,
  selectedCount,
  submitting,
  onSubmit,
  submitLabel,
}: {
  readonly quote: Quote | null;
  readonly estimateMinor: number;
  readonly selectedCount: number;
  readonly submitting: boolean;
  readonly onSubmit: () => void;
  readonly submitLabel?: string;
}) {
  const subtotal = quote?.subtotalMinor ?? estimateMinor;
  const discount = quote?.discountMinor ?? 0;
  const shipping = quote?.shippingMinor ?? 0;
  const payable = quote?.payableMinor ?? estimateMinor;
  return (
    <aside className="sw-web-checkout-summary sticky top-[100px] space-y-3 rounded-lg border border-gray-200 bg-white p-3.5 shadow-xs md:col-span-4">
      <h2 className="border-b border-gray-100 pb-2 text-sm font-extrabold text-gray-900">结算汇总与福利支付</h2>
      <TenderPanel quote={quote} />
      <div className="space-y-1.5 border-t border-gray-100 pt-2.5 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>商品金额小计</span>
          <b className="text-gray-800">¥{formatMinor(subtotal)}</b>
        </div>
        <div className="flex justify-between">
          <span>服务端优惠</span>
          <span>-¥{formatMinor(discount)}</span>
        </div>
        <div className="flex justify-between">
          <span>配送费用</span>
          <span>¥{formatMinor(shipping)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-1 text-sm font-bold text-gray-900">
          <span>{quote ? '权威应付金额' : '当前选择估算'}</span>
          <b className="text-base font-black text-[var(--sw-promotion)]">¥{formatMinor(payable)}</b>
        </div>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={selectedCount === 0 || submitting}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--sw-brand)] py-3 text-xs font-extrabold text-white shadow-md hover:bg-blue-700 disabled:bg-gray-300"
      >
        <Zap className="h-4 w-4 text-yellow-300" />
        {submitting ? '安全提交中…' : (submitLabel ?? `确认并提交真实订单（${selectedCount}）`)}
        <ArrowRight className="h-4 w-4" />
      </button>
      <div className="flex items-center justify-center gap-1 text-center text-[10px] text-gray-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        价格、资格、库存和支付拆分均由服务端重新校验
      </div>
    </aside>
  );
}
