import React from 'react';
import { Check, ChevronDown, ShieldCheck, WalletCards, X } from 'lucide-react';
import type { FrontendOrder } from '../../adapters/frontendData';
import { mobileOrderPayableAmount } from './mobileOrderPresentation';

interface MobilePaymentSheetProps {
  order: FrontendOrder;
  onClose: () => void;
  onConfirm: () => void;
}

export function MobilePaymentSheet({ order, onClose, onConfirm }: Readonly<MobilePaymentSheetProps>) {
  const payableAmount = mobileOrderPayableAmount(order);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const dialogRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-[80] flex items-end bg-[#101827]/40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <button type="button" tabIndex={-1} aria-label="关闭付款" onClick={onClose} className="absolute inset-0 cursor-default" />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative z-10 w-full rounded-t-[30px] border-t border-white bg-white px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_48px_rgba(15,23,42,0.18)] outline-none motion-safe:animate-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-300 motion-safe:[animation-timing-function:cubic-bezier(0.32,0.72,0,1)]"
      >
        <div className="mx-auto h-1 w-9 rounded-full bg-slate-200" />

        <header className="mt-3 flex items-center justify-between">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[16px] font-black tracking-[-0.02em] text-slate-950">确认付款</h2>
            <p id={descriptionId} className="mt-0.5 truncate font-mono text-[8px] tracking-wide text-slate-400">{order.orderNo}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F3F6F9] text-slate-500 transition-transform duration-150 active:scale-90" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative mt-4 overflow-hidden rounded-[22px] border border-[#DCE7F3] bg-gradient-to-br from-white via-[#F7FAFD] to-[#EDF4FB] px-4 py-4 text-center">
          <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_88%_10%,rgba(194,220,244,0.42),transparent_42%)]" />
          <div className="relative">
            <p className="text-[9px] font-semibold tracking-[0.1em] text-[#7189A4]">本次还需支付</p>
            <p className="mt-1 text-[32px] font-black tracking-[-0.045em] text-[#203A59]"><span className="mr-1 text-[15px]">¥</span>{payableAmount.toFixed(2)}</p>
            <p className="mt-1.5 text-[8px] text-[#8192A6]">支付完成前，订单会为你保留</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-[18px] border border-[#E6EDF5] bg-white p-3 shadow-[0_7px_20px_rgba(33,52,78,0.045)]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#ECF8F0] text-[#08A84F]">
            <WalletCards className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[11px] text-slate-900">微信支付</strong>
            <span className="mt-0.5 block text-[8px] text-slate-400">用于支付订单补差金额</span>
          </span>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--sw-brand)] text-white"><Check className="h-3 w-3" /></span>
        </div>

        <details className="group mt-2 overflow-hidden rounded-[16px] bg-[#F7F9FC]">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 text-[9px] text-slate-500 [&::-webkit-details-marker]:hidden">
            <span>查看支付明细</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-300 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t border-slate-100 px-3 py-2.5 text-[9px] text-slate-500">
            <PaymentRow label="商品金额" value={`¥${order.payment.totalGoodsAmount.toFixed(2)}`} />
            {order.payment.shippingFee > 0 ? <PaymentRow label="配送费" value={`¥${order.payment.shippingFee.toFixed(2)}`} /> : <PaymentRow label="配送费" value="免运费" />}
            {order.payment.welfareDeducted > 0 && <PaymentRow label="福利卡抵扣" value={`-¥${order.payment.welfareDeducted.toFixed(2)}`} benefit />}
            {order.payment.mealDeducted > 0 && <PaymentRow label="餐卡抵扣" value={`-¥${order.payment.mealDeducted.toFixed(2)}`} benefit />}
          </div>
        </details>

        <button type="button" onClick={onConfirm} className="mt-3 min-h-12 w-full touch-manipulation rounded-[17px] bg-[var(--sw-brand)] text-[13px] font-black text-white shadow-[0_10px_24px_rgba(36,105,232,0.22)] transition-[transform,box-shadow] duration-150 active:scale-[0.985] active:shadow-[0_5px_14px_rgba(36,105,232,0.18)]">
          微信支付 ¥{payableAmount.toFixed(2)}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1 text-[8px] text-slate-400"><ShieldCheck className="h-3 w-3" />支付结果将与订单状态自动同步</p>
      </section>
    </div>
  );
}

function PaymentRow({ label, value, benefit = false }: Readonly<{ label: string; value: string; benefit?: boolean }>) {
  return <div className="flex items-center justify-between gap-3"><span>{label}</span><span className={benefit ? 'font-bold text-[#4D7C70]' : 'font-semibold text-slate-700'}>{value}</span></div>;
}
