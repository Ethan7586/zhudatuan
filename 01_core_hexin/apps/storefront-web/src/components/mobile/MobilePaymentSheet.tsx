import { Check, ChevronDown, ShieldCheck, WalletCards, X } from 'lucide-react';
import type { FrontendOrder } from '../../adapters/frontendData';

interface MobilePaymentSheetProps {
  order: FrontendOrder;
  onClose: () => void;
  onConfirm: () => void;
}

export function MobilePaymentSheet({ order, onClose, onConfirm }: Readonly<MobilePaymentSheetProps>) {
  const payableAmount = order.payment.wechatPaid > 0 ? order.payment.wechatPaid : order.totalAmount;

  return (
    <div className="absolute inset-0 z-[80] flex items-end bg-slate-950/32 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="继续付款">
      <button type="button" aria-label="关闭付款" onClick={onClose} className="absolute inset-0" />
      <section className="relative z-10 w-full rounded-t-[30px] bg-white px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgba(15,23,42,0.16)]">
        <div className="mx-auto h-1 w-10 rounded-full bg-gray-200" />
        <header className="mt-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-gray-950">继续付款</h2>
            <p className="mt-0.5 text-[9px] text-gray-400">订单 {order.orderNo}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-500" aria-label="关闭"><X className="h-4 w-4" /></button>
        </header>

        <div className="py-5 text-center">
          <p className="text-[10px] text-gray-400">仍需支付</p>
          <p className="mt-1 text-[34px] font-black tracking-tight text-gray-950"><span className="mr-1 text-base">¥</span>{payableAmount.toFixed(2)}</p>
          <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700">订单保留 14:59</span>
        </div>

        <div className="rounded-2xl bg-[#F7F9FC] px-3 py-2.5 text-[10px] text-gray-500">
          <div className="flex items-center justify-between"><span>商品合计</span><span className="font-medium text-gray-700">¥{order.payment.totalGoodsAmount.toFixed(2)}</span></div>
          {order.payment.welfareDeducted > 0 && <div className="mt-2 flex items-center justify-between"><span>福利卡已抵扣</span><span className="font-bold text-emerald-600">-¥{order.payment.welfareDeducted.toFixed(2)}</span></div>}
        </div>

        <button type="button" className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/55 p-3 text-left">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#07C160] text-white"><WalletCards className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-xs text-gray-900">微信支付</strong><span className="mt-0.5 block text-[9px] text-gray-400">安全快捷支付</span></span>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--sw-brand)] text-white"><Check className="h-3 w-3" /></span>
        </button>

        <button type="button" className="mt-2 flex w-full items-center justify-between px-1 py-2 text-[10px] text-gray-500"><span>其他支付方式</span><ChevronDown className="h-4 w-4 text-gray-300" /></button>

        <button type="button" onClick={onConfirm} className="mt-2 min-h-12 w-full rounded-2xl bg-[var(--sw-brand)] text-sm font-black text-white shadow-[0_10px_26px_rgba(36,105,232,0.25)] active:scale-[0.99]">确认支付 ¥{payableAmount.toFixed(2)}</button>
        <p className="mt-3 flex items-center justify-center gap-1 text-[9px] text-gray-400"><ShieldCheck className="h-3 w-3" />支付结果以微信与订单状态同步为准</p>
      </section>
    </div>
  );
}
