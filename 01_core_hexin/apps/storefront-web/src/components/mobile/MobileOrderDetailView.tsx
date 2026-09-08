import { ChevronDown, ChevronLeft, Clock3, MapPin, Package, PackageCheck, ReceiptText, RotateCcw, Store, Truck, WalletCards } from 'lucide-react';
import type { FrontendOrder } from '../../adapters/frontendData';
import { useMall, type MobileFulfillmentStage } from '../../context/MallContext';
import { storefrontImageUrl } from '../../services/storefrontImageUrl';
import { effectiveMobileFulfillmentStage, mobileFulfillmentStageLabel } from './mobileOrderFulfillment';
import { groupOrderPackages, mobileOrderPayableAmount } from './mobileOrderPresentation';

interface MobileOrderDetailViewProps {
  order: FrontendOrder;
  onBack: () => void;
  onContinuePayment: () => void;
  onAfterSale: () => void;
}

const DELIVERY_STEPS = ['已下单', '备货', '运输', '收货'] as const;

export function MobileOrderDetailView({ order, onBack, onContinuePayment, onAfterSale }: Readonly<MobileOrderDetailViewProps>) {
  const { mobileFulfillmentSimulationStage } = useMall();
  const fulfillmentStage = effectiveMobileFulfillmentStage(order, mobileFulfillmentSimulationStage);
  const packages = groupOrderPackages(order, fulfillmentStage);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const canPay = order.status === 'pending_payment' || order.status === 'pending_pay';
  const isAfterSale = order.status === 'after_sale';
  const canAfterSale = isAfterSale || order.status === 'completed' || fulfillmentStage !== null;
  const afterSaleActionLabel = isAfterSale
    ? '查看售后进度'
    : order.status === 'completed' || fulfillmentStage === 'received'
      ? '申请退货/退款'
      : '申请退款';
  const displayStatusText = fulfillmentStage ? mobileFulfillmentStageLabel(fulfillmentStage) : order.statusText;
  const payableAmount = mobileOrderPayableAmount(order);
  const currentStep = deliveryProgressIndex(order.status, fulfillmentStage);

  return (
    <div className="min-h-full bg-[#F3F5F8] pb-24 text-slate-800 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-1 motion-safe:duration-200">
      <header className="sticky top-0 z-30 flex min-h-[58px] items-center gap-3 border-b border-slate-100 bg-white px-3 shadow-[0_5px_18px_rgba(25,45,72,0.035)]">
        <button type="button" onClick={onBack} className="grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full text-slate-700 transition-transform duration-150 active:scale-90 active:bg-slate-100" aria-label="返回订单列表">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[15px] font-black tracking-[-0.01em] text-slate-950">订单详情</h1>
          <p className="mt-0.5 truncate font-mono text-[8px] tracking-wide text-slate-400">{order.orderNo}</p>
        </div>
      </header>

      <main className="space-y-3 px-3 py-3.5">
        <section className="relative overflow-hidden rounded-[24px] border border-[#DCE7F3] bg-gradient-to-br from-white via-[#F7FAFD] to-[#EDF4FB] p-4 shadow-[0_12px_30px_rgba(40,65,96,0.06)]">
          <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_92%_4%,rgba(198,222,245,0.52),transparent_42%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold tracking-[0.12em] text-[#7890AA]">当前进度</p>
              <h2 className="mt-1.5 text-[22px] font-black tracking-[-0.03em] text-[#203A59]">{displayStatusText}</h2>
              <p className="mt-1.5 max-w-[245px] text-[10px] leading-4 text-[#6F8298]">{statusHint(order.status, fulfillmentStage)}</p>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[17px] border border-white bg-white/75 text-[#597CA5] shadow-[0_7px_18px_rgba(66,96,132,0.09)]">
              <OrderStageIcon status={order.status} fulfillmentStage={fulfillmentStage} />
            </span>
          </div>

          <ol className="relative mt-5 grid grid-cols-4" aria-label="订单履约进度">
            {DELIVERY_STEPS.map((step, index) => {
              const reached = index <= currentStep;
              const current = index === currentStep;
              return (
                <li key={step} className="relative flex flex-col items-center gap-2">
                  {index < DELIVERY_STEPS.length - 1 && <span className={`absolute left-1/2 right-[-50%] top-[5px] h-px ${index < currentStep ? 'bg-[#7FA1C8]' : 'bg-[#D6E0EA]'}`} />}
                  <span className={`relative z-10 h-[11px] w-[11px] rounded-full border-2 ${current ? 'border-[#6D91BB] bg-white shadow-[0_0_0_4px_rgba(109,145,187,0.12)]' : reached ? 'border-[#7FA1C8] bg-[#7FA1C8]' : 'border-[#CFD9E4] bg-[#F7FAFD]'}`} />
                  <span className={`text-[8px] ${reached ? 'font-bold text-[#49698D]' : 'font-medium text-slate-400'}`}>{step}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="overflow-hidden rounded-[22px] border border-white bg-white shadow-[0_10px_28px_rgba(33,52,78,0.045)]">
          <div className="flex items-center justify-between px-3.5 py-3">
            <div>
              <h3 className="text-[12px] font-black text-slate-900">配送进度</h3>
              <p className="mt-0.5 text-[9px] text-slate-400">{packages.length > 1 ? '不同商户独立发货，到货时间可能不同' : '商户备货与物流进度将在这里更新'}</p>
            </div>
            <span className="rounded-full bg-[#EEF4FB] px-2.5 py-1 text-[9px] font-bold text-[#55769D]">{packages.length} 个包裹</span>
          </div>

          <div className="border-t border-slate-100 px-3.5">
            {packages.map((deliveryPackage, packageIndex) => (
              <article key={deliveryPackage.id} className="border-b border-slate-100 py-3.5 [content-visibility:auto] [contain-intrinsic-size:116px] last:border-b-0">
                <header className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-[#F0F5FB] text-[#56779F]"><Store className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-black text-slate-800">包裹 {packageIndex + 1} · {deliveryPackage.merchantName}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[8px] text-slate-400"><Clock3 className="h-2.5 w-2.5" />{deliveryPackage.deliveryHint}</span>
                    </span>
                  </div>
                  <span className="shrink-0 pt-1 text-[9px] font-bold text-[#55769D]">{deliveryPackage.statusLabel}</span>
                </header>

                <div className="mt-3 space-y-3 pl-9">
                  {deliveryPackage.items.map((item, itemIndex) => {
                    const isPriorityImage = packageIndex === 0 && itemIndex === 0;
                    return (
                      <div key={`${deliveryPackage.id}-${item.productId}`} className="flex gap-2.5">
                        <img
                          src={storefrontImageUrl(item.product.imageUrl, 112)}
                          srcSet={`${storefrontImageUrl(item.product.imageUrl, 56)} 1x, ${storefrontImageUrl(item.product.imageUrl, 112)} 2x, ${storefrontImageUrl(item.product.imageUrl, 168)} 3x`}
                          alt={item.productTitle}
                          width={56}
                          height={56}
                          loading={isPriorityImage ? 'eager' : 'lazy'}
                          fetchPriority={isPriorityImage ? 'high' : 'low'}
                          decoding="async"
                          className="h-14 w-14 shrink-0 rounded-[14px] bg-[#F5F7FA] object-cover"
                        />
                        <div className="min-w-0 flex-1 py-0.5">
                          <p className="line-clamp-2 text-[10px] font-bold leading-4 text-slate-800">{item.productTitle}</p>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] text-slate-400">
                            <span className="truncate">{item.specText || '默认规格'} · ×{item.quantity}</span>
                            <span className="shrink-0 font-semibold text-slate-700">¥{item.priceAtPurchase.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>

        {order.address && (
          <section className="rounded-[22px] border border-white bg-white p-3.5 shadow-[0_10px_28px_rgba(33,52,78,0.045)]">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-[#F0F5FB] text-[#56779F]"><MapPin className="h-[17px] w-[17px]" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold tracking-wide text-slate-400">送达信息</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black text-slate-900">
                  <span>{order.address.name}</span>
                  <span className="font-mono text-[9px] font-medium text-slate-500">{order.address.phone}</span>
                  {order.address.tag && <span className="rounded-md bg-[#F0F5FB] px-1.5 py-0.5 text-[8px] font-semibold text-[#5D7898]">{order.address.tag}</span>}
                </div>
                <p className="mt-1.5 text-[10px] leading-4 text-slate-500">{order.address.province}{order.address.city}{order.address.district}{order.address.detail}</p>
              </div>
            </div>
          </section>
        )}

        <details className="group overflow-hidden rounded-[22px] border border-white bg-white shadow-[0_10px_28px_rgba(33,52,78,0.045)]">
          <summary className="flex min-h-[58px] touch-manipulation cursor-pointer list-none items-center justify-between gap-3 px-3.5 transition-colors duration-150 active:bg-[#F7F9FC] [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-[#F0F5FB] text-[#56779F]"><ReceiptText className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block text-[11px] font-black text-slate-900">金额与支付</span><span className="mt-0.5 block truncate text-[8px] text-slate-400">{order.payment.payMethodText}</span></span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-500"><strong className={`text-[15px] font-black ${canPay ? 'text-[#D9544F]' : 'text-slate-900'}`}>¥{(canPay ? payableAmount : order.totalAmount).toFixed(2)}</strong><ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" /></span>
          </summary>
          <div className="space-y-2.5 border-t border-slate-100 px-3.5 py-3 text-[10px] text-slate-500">
            <AmountRow label={`商品金额 · 共 ${itemCount} 件`} value={`¥${order.payment.totalGoodsAmount.toFixed(2)}`} />
            <AmountRow label="配送费" value={order.payment.shippingFee > 0 ? `¥${order.payment.shippingFee.toFixed(2)}` : '免运费'} />
            {order.payment.welfareDeducted > 0 && <AmountRow label="福利卡抵扣" value={`-¥${order.payment.welfareDeducted.toFixed(2)}`} tone="benefit" />}
            {order.payment.mealDeducted > 0 && <AmountRow label="餐卡抵扣" value={`-¥${order.payment.mealDeducted.toFixed(2)}`} tone="benefit" />}
          </div>
        </details>
      </main>

      {(canPay || canAfterSale) && (
        <footer className="absolute inset-x-0 bottom-0 z-40 flex min-h-[62px] items-center justify-between gap-3 border-t border-slate-100 bg-white px-3.5 py-2.5 shadow-[0_-8px_24px_rgba(33,52,78,0.04)]">
          <div className="flex items-center gap-1.5 text-[9px] font-medium text-slate-400"><WalletCards className="h-4 w-4" />订单服务</div>
          {canPay && <button type="button" onClick={onContinuePayment} className="min-h-10 touch-manipulation rounded-full bg-[var(--sw-brand)] px-6 text-[11px] font-black text-white shadow-[0_8px_18px_rgba(36,105,232,0.2)] transition-transform duration-150 active:scale-95">继续付款</button>}
          {canAfterSale && <button type="button" onClick={onAfterSale} className={`min-h-10 touch-manipulation rounded-full px-5 text-[10px] font-black transition-transform duration-150 active:scale-95 ${isAfterSale ? 'bg-[#F1EEFB] text-[#6E5B9C]' : 'border border-[#D9E2ED] bg-white text-slate-700'}`}>{afterSaleActionLabel}</button>}
        </footer>
      )}
    </div>
  );
}

function OrderStageIcon({ status, fulfillmentStage }: Readonly<{ status: FrontendOrder['status']; fulfillmentStage: MobileFulfillmentStage | null }>) {
  if (status === 'after_sale') return <RotateCcw className="h-5 w-5" />;
  if (status === 'completed' || fulfillmentStage === 'received') return <PackageCheck className="h-5 w-5" />;
  if (fulfillmentStage === 'processing') return <Package className="h-5 w-5" />;
  if (fulfillmentStage === 'shipped') return <Truck className="h-5 w-5" />;
  return <WalletCards className="h-5 w-5" />;
}

function AmountRow({ label, value, tone = 'default' }: Readonly<{ label: string; value: string; tone?: 'default' | 'benefit' }>) {
  return <div className="flex items-center justify-between gap-3"><span>{label}</span><span className={tone === 'benefit' ? 'font-bold text-[#4D7C70]' : 'font-semibold text-slate-700'}>{value}</span></div>;
}

function deliveryProgressIndex(status: FrontendOrder['status'], fulfillmentStage: MobileFulfillmentStage | null): number {
  if (status === 'completed' || status === 'after_sale' || fulfillmentStage === 'received') return 3;
  if (fulfillmentStage === 'shipped' || status === 'pending_receipt' || status === 'shipping' || status === 'shipped') return 2;
  if (fulfillmentStage === 'processing' || status === 'pending_shipment' || status === 'paid') return 1;
  return 0;
}

function statusHint(status: FrontendOrder['status'], fulfillmentStage: MobileFulfillmentStage | null): string {
  if (status === 'pending_payment' || status === 'pending_pay') return '订单已为你保留，完成付款后将开始备货';
  if (fulfillmentStage === 'processing') return '商户正在备货，发出后会自动更新物流';
  if (fulfillmentStage === 'shipped') return '包裹已经在路上，可在下方查看物流进度';
  if (fulfillmentStage === 'received') return '包裹已签收，如有需要仍可申请退货或退款';
  if (status === 'completed') return '订单已完成，售后服务仍在有效期内';
  return '售后申请正在处理，新进度会及时更新';
}
