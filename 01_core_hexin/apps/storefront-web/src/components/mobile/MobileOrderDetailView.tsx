import { ChevronLeft, Clock3, MapPin, PackageCheck, ReceiptText, Store, Truck, WalletCards } from 'lucide-react';
import type { FrontendOrder } from '../../adapters/frontendData';
import { MobileInventoryBadge } from './MobileInventoryBadge';
import { groupOrderPackages } from './mobileOrderPresentation';

interface MobileOrderDetailViewProps {
  order: FrontendOrder;
  onBack: () => void;
  onContinuePayment: () => void;
  onAfterSale: () => void;
}

export function MobileOrderDetailView({ order, onBack, onContinuePayment, onAfterSale }: Readonly<MobileOrderDetailViewProps>) {
  const packages = groupOrderPackages(order);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const canPay = order.status === 'pending_payment' || order.status === 'pending_pay';
  const canAfterSale = order.status === 'completed';
  const payableAmount = order.payment.wechatPaid > 0 ? order.payment.wechatPaid : order.totalAmount;

  return (
    <div className="min-h-full bg-[#F3F6FA] pb-24 text-gray-800">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-3 py-3 backdrop-blur">
        <button type="button" onClick={onBack} className="rounded-full p-1.5 active:bg-gray-100" aria-label="返回订单列表">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-sm font-black text-gray-950">订单详情</h1>
          <p className="mt-0.5 font-mono text-[9px] text-gray-400">{order.orderNo}</p>
        </div>
      </header>

      <main className="space-y-3 p-3">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#17469D] via-[#1E5BD0] to-[#3A7BEE] p-4 text-white shadow-[0_16px_34px_rgba(30,91,208,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] text-blue-100">当前进度</p>
              <h2 className="mt-1 text-xl font-black">{order.statusText}</h2>
              <p className="mt-1 text-[10px] text-blue-100">{statusHint(order.status)}</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/12">
              {order.status === 'completed' ? <PackageCheck className="h-6 w-6" /> : <Truck className="h-6 w-6" />}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[9px]">
            {['已下单', '履约中', '已完成'].map((step, index) => {
              const reached = index <= progressIndex(order.status);
              return (
                <div key={step} className="space-y-1.5">
                  <div className={`mx-auto h-1.5 rounded-full ${reached ? 'bg-white' : 'bg-white/25'}`} />
                  <span className={reached ? 'font-bold text-white' : 'text-blue-100'}>{step}</span>
                </div>
              );
            })}
          </div>
        </section>

        {order.address && (
          <section className="rounded-3xl border border-gray-100 bg-white p-3.5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-[var(--sw-brand)]"><MapPin className="h-[18px] w-[18px]" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-black text-gray-900">
                  <span>{order.address.name}</span>
                  <span className="font-mono text-[10px] font-medium text-gray-400">{order.address.phone}</span>
                  {order.address.tag && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[8px] text-blue-600">{order.address.tag}</span>}
                </div>
                <p className="mt-1.5 text-[10px] leading-4 text-gray-500">{order.address.province}{order.address.city}{order.address.district}{order.address.detail}</p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-gray-950">分商户配送</h3>
              <p className="mt-0.5 text-[9px] text-gray-400">不同商户独立备货，物流分别更新</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-bold text-blue-600">{packages.length} 个包裹</span>
          </div>

          <div className="mt-3 space-y-3">
            {packages.map((deliveryPackage, packageIndex) => (
              <article key={deliveryPackage.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-[#F8FAFD]">
                <header className="flex items-center justify-between border-b border-white bg-white/70 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Store className="h-4 w-4 shrink-0 text-[var(--sw-brand)]" />
                    <span className="truncate text-[10px] font-bold text-gray-800">包裹 {packageIndex + 1} · {deliveryPackage.merchantName}</span>
                  </div>
                  <span className="shrink-0 text-[9px] font-bold text-blue-600">{deliveryPackage.statusLabel}</span>
                </header>

                <div className="space-y-2.5 p-3">
                  {deliveryPackage.items.map((item) => (
                    <div key={`${deliveryPackage.id}-${item.productId}`} className="flex gap-2.5">
                      <img src={item.product.imageUrl} alt={item.productTitle} className="h-14 w-14 shrink-0 rounded-xl bg-white object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[10px] font-bold leading-4 text-gray-800">{item.productTitle}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <MobileInventoryBadge product={item.product} />
                          <span className="text-[9px] text-gray-400">¥{item.priceAtPurchase.toFixed(2)} × {item.quantity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 border-t border-white pt-2 text-[9px] text-gray-400">
                    <Clock3 className="h-3 w-3" />
                    <span>{deliveryPackage.deliveryHint}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black text-gray-950"><ReceiptText className="h-4 w-4 text-[var(--sw-brand)]" />金额明细</div>
          <div className="mt-3 space-y-2 text-[10px] text-gray-500">
            <AmountRow label={`商品金额 · 共 ${itemCount} 件`} value={`¥${order.payment.totalGoodsAmount.toFixed(2)}`} />
            <AmountRow label="配送费" value={order.payment.shippingFee > 0 ? `¥${order.payment.shippingFee.toFixed(2)}` : '免运费'} />
            {order.payment.welfareDeducted > 0 && <AmountRow label="福利卡抵扣" value={`-¥${order.payment.welfareDeducted.toFixed(2)}`} tone="benefit" />}
            {order.payment.mealDeducted > 0 && <AmountRow label="餐卡抵扣" value={`-¥${order.payment.mealDeducted.toFixed(2)}`} tone="benefit" />}
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-gray-100 pt-3">
            <span className="text-[10px] text-gray-400">{order.payment.payMethodText}</span>
            <span className="text-[10px] text-gray-500">{canPay ? '待支付' : '实付'} <strong className="ml-1 text-xl font-black text-[#E5484D]">¥{(canPay ? payableAmount : order.totalAmount).toFixed(2)}</strong></span>
          </div>
        </section>
      </main>

      {(canPay || canAfterSale) && (
        <footer className="absolute inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-gray-100 bg-white/96 px-3 py-2.5 backdrop-blur">
          <div className="flex items-center gap-1.5 text-[9px] text-gray-400"><WalletCards className="h-4 w-4" />订单服务</div>
          {canPay && <button type="button" onClick={onContinuePayment} className="min-h-10 rounded-full bg-[var(--sw-brand)] px-6 text-xs font-black text-white shadow-[0_8px_20px_rgba(36,105,232,0.24)]">继续付款</button>}
          {canAfterSale && <button type="button" onClick={onAfterSale} className="min-h-10 rounded-full border border-gray-200 bg-white px-6 text-xs font-black text-gray-800 active:bg-gray-50">申请退货/退款</button>}
        </footer>
      )}
    </div>
  );
}

function AmountRow({ label, value, tone = 'default' }: Readonly<{ label: string; value: string; tone?: 'default' | 'benefit' }>) {
  return <div className="flex items-center justify-between"><span>{label}</span><span className={tone === 'benefit' ? 'font-bold text-emerald-600' : 'font-medium text-gray-700'}>{value}</span></div>;
}

function progressIndex(status: FrontendOrder['status']): number {
  if (status === 'completed' || status === 'after_sale') return 2;
  if (status === 'pending_shipment' || status === 'pending_receipt' || status === 'paid' || status === 'shipping' || status === 'shipped') return 1;
  return 0;
}

function statusHint(status: FrontendOrder['status']): string {
  if (status === 'pending_payment' || status === 'pending_pay') return '订单已保留，请在有效时间内完成付款';
  if (status === 'pending_shipment' || status === 'paid') return '商户正在备货，包裹将分别发出';
  if (status === 'pending_receipt' || status === 'shipping' || status === 'shipped') return '包裹正在路上，请留意物流更新';
  if (status === 'completed') return '订单已完成，仍可发起售后服务';
  return '售后申请已受理，进度将在这里更新';
}
