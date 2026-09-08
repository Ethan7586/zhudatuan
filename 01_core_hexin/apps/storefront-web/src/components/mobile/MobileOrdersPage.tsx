import React from 'react';
import { ChevronLeft, ChevronRight, Package, PackageCheck, RefreshCw, RotateCcw, Store, Truck, WalletCards } from 'lucide-react';
import type { FrontendOrder } from '../../adapters/frontendData';
import { useMall, type MobileFulfillmentStage } from '../../context/MallContext';
import { storefrontImageUrl } from '../../services/storefrontImageUrl';
import { MobileAfterSaleView } from './MobileAfterSaleView';
import { MobileOrderDetailView } from './MobileOrderDetailView';
import { MobilePaymentSheet } from './MobilePaymentSheet';
import { OrderFlowIcon } from './OrderFlowIcon';
import { currentMobileOrderFilter, matchesMobileOrderFilter, selectMobileOrderFilter, type MobileOrderFilter } from './mobileOrderFilters';
import { groupOrderPackages, mobileOrderPayableAmount } from './mobileOrderPresentation';
import {
  effectiveMobileFulfillmentStage,
  mobileFulfillmentSimulationAction,
  mobileFulfillmentStageLabel,
  nextMobileFulfillmentStage,
  summarizeMobileFulfillment,
} from './mobileOrderFulfillment';

interface MobileOrdersPageProps {
  mode: 'mini-program' | 'android-app';
}

const FILTER_OPTIONS: ReadonlyArray<Readonly<{ id: MobileOrderFilter; label: string }>> = [
  { id: 'all', label: '全部' },
  { id: 'pending_payment', label: '待付款' },
  { id: 'pending_shipment', label: '履约中' },
  { id: 'completed', label: '已完成' },
  { id: 'after_sale', label: '售后' },
];

export const MobileOrdersPage: React.FC<MobileOrdersPageProps> = ({ mode }) => {
  const {
    presentationOrders,
    mobileFulfillmentSimulationStage,
    setMobileFulfillmentSimulationStage,
    setMpPage,
    setAndroidPage,
    showToast,
    triggerPendingFeature,
  } = useMall();
  const [activeFilter, setActiveFilter] = React.useState<MobileOrderFilter>(() => currentMobileOrderFilter());
  const [selectedOrder, setSelectedOrder] = React.useState<FrontendOrder | null>(null);
  const [orderView, setOrderView] = React.useState<'list' | 'detail' | 'after-sale'>('list');
  const [paymentOrder, setPaymentOrder] = React.useState<FrontendOrder | null>(null);
  const [showPreviewControl, setShowPreviewControl] = React.useState(false);
  React.useEffect(() => {
    setShowPreviewControl(window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');
  }, []);
  const visibleOrders = React.useMemo(
    () => presentationOrders.filter((order) => matchesMobileOrderFilter(order.status, activeFilter)),
    [activeFilter, presentationOrders],
  );
  const fulfillment = React.useMemo(
    () => summarizeMobileFulfillment(presentationOrders, mobileFulfillmentSimulationStage),
    [mobileFulfillmentSimulationStage, presentationOrders],
  );
  const filterOptions = React.useMemo(() => FILTER_OPTIONS.map((option) => (
    option.id === 'pending_shipment' ? { ...option, label: fulfillment.label } : option
  )), [fulfillment.label]);
  const filterCounts = React.useMemo(() => Object.fromEntries(FILTER_OPTIONS.map((option) => [
    option.id,
    presentationOrders.filter((order) => matchesMobileOrderFilter(order.status, option.id)).length,
  ])) as Record<MobileOrderFilter, number>, [presentationOrders]);
  const activeLabel = filterOptions.find((option) => option.id === activeFilter)?.label ?? '全部';
  const emptyState = mobileOrderEmptyState(activeFilter, activeLabel);

  const chooseFilter = (filter: MobileOrderFilter) => {
    selectMobileOrderFilter(filter);
    setActiveFilter(filter);
  };

  const simulateNextFulfillmentStage = () => {
    const nextStage = nextMobileFulfillmentStage(fulfillment.stage);
    setMobileFulfillmentSimulationStage(nextStage);
    showToast(`状态演示：${fulfillment.count} 笔订单已同步为${mobileFulfillmentStageLabel(nextStage)}`, 'info');
  };

  const openOrderView = (order: FrontendOrder, view: 'detail' | 'after-sale') => {
    setSelectedOrder(order);
    setOrderView(view);
  };

  const paymentSheet = paymentOrder && (
    <MobilePaymentSheet
      order={paymentOrder}
      onClose={() => setPaymentOrder(null)}
      onConfirm={() => {
        setPaymentOrder(null);
        triggerPendingFeature('继续付款', `订单 ${paymentOrder.orderNo} 的支付界面已完成，等待接入微信支付创建与回调接口。`);
      }}
    />
  );

  const goBack = () => {
    if (mode === 'mini-program') setMpPage('profile');
    else setAndroidPage('profile');
  };

  if (selectedOrder && orderView === 'detail') {
    return (
      <div className="relative min-h-full">
        <MobileOrderDetailView
          order={selectedOrder}
          onBack={() => setOrderView('list')}
          onContinuePayment={() => setPaymentOrder(selectedOrder)}
          onAfterSale={() => setOrderView('after-sale')}
        />
        {paymentSheet}
      </div>
    );
  }

  if (selectedOrder && orderView === 'after-sale') {
    return (
      <div className="relative min-h-full">
        <MobileAfterSaleView
          order={selectedOrder}
          onBack={() => setOrderView('detail')}
          onSubmit={() => triggerPendingFeature('售后申请提交', `订单 ${selectedOrder.orderNo} 的退货退款表单已完成，等待接入售后提交与审核接口。`)}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-[#F3F5F8] pb-20 text-slate-800 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <div className="sticky top-0 z-30 border-b border-slate-100 bg-white shadow-[0_5px_18px_rgba(25,45,72,0.035)]">
        <header className="flex min-h-[58px] items-center gap-3 px-3">
          <button type="button" onClick={goBack} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-700 transition-transform duration-150 active:scale-90 active:bg-slate-100" aria-label="返回个人中心">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-black tracking-[-0.01em] text-slate-950">我的订单</h1>
            <p className="mt-0.5 text-[9px] tracking-wide text-slate-400">
              {presentationOrders.length > 0 ? `${presentationOrders.length} 笔订单 · 进度实时同步` : '订单进度会及时同步'}
            </p>
          </div>
          {showPreviewControl && fulfillment.count > 0 && (
            <button
              type="button"
              onClick={simulateNextFulfillmentStage}
              title={mobileFulfillmentSimulationAction(fulfillment.stage)}
              aria-label={mobileFulfillmentSimulationAction(fulfillment.stage)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#DDE8F6] bg-[#F5F9FE] text-[#52739D] transition-transform duration-150 active:scale-90"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </header>

        <nav aria-label="订单状态筛选" className="grid grid-cols-5 px-2">
          {filterOptions.map((option) => {
            const count = filterCounts[option.id];
            const isActive = option.id === activeFilter;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => chooseFilter(option.id)}
                className={`relative flex min-h-11 touch-manipulation items-center justify-center gap-0.5 px-0.5 text-[10px] font-bold transition-[color,transform] duration-150 active:scale-[0.96] ${isActive ? 'text-[var(--sw-brand)]' : 'text-slate-400 active:text-slate-700'}`}
              >
                <span key={option.label} aria-live={option.id === 'pending_shipment' ? 'polite' : undefined}>{option.label}</span>
                {count > 0 && <span className={`text-[8px] font-semibold ${isActive ? 'text-[#7899C2]' : 'text-slate-300'}`}>{count > 99 ? '99+' : count}</span>}
                <span className={`absolute bottom-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-[var(--sw-brand)] transition-[width,opacity] duration-200 ${isActive ? 'w-5 opacity-100' : 'w-0 opacity-0'}`} />
              </button>
            );
          })}
        </nav>
      </div>

      <main key={activeFilter} className="space-y-3 px-3 py-3.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
        {visibleOrders.length === 0 ? (
          <div role="status" className="rounded-[22px] border border-white bg-white px-6 py-10 text-center shadow-[0_10px_28px_rgba(33,52,78,0.045)]">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-[20px] bg-[#F0F5FB] text-[#6482A8]">
              <OrderFlowIcon className="h-10 w-10" />
            </div>
            <p className="text-[13px] font-black text-slate-800">{emptyState.title}</p>
            <p className="mt-1.5 text-[10px] leading-4 text-slate-400">{emptyState.detail}</p>
          </div>
        ) : (
          visibleOrders.map((order, orderIndex) => {
            const firstItem = order.items[0];
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const isPendingPayment = order.status === 'pending_payment' || order.status === 'pending_pay';
            const fulfillmentStage = effectiveMobileFulfillmentStage(order, mobileFulfillmentSimulationStage);
            const displayStatusText = fulfillmentStage ? mobileFulfillmentStageLabel(fulfillmentStage) : order.statusText;
            const displayAmount = isPendingPayment ? mobileOrderPayableAmount(order) : order.totalAmount;
            const packages = groupOrderPackages(order, fulfillmentStage);
            const primaryAction = mobileOrderPrimaryAction(order.status, fulfillmentStage);
            const statusTone = orderStatusTone(order.status, fulfillmentStage);

            const runPrimaryAction = () => {
              if (primaryAction.kind === 'payment') setPaymentOrder(order);
              else if (primaryAction.kind === 'after-sale') openOrderView(order, 'after-sale');
              else openOrderView(order, 'detail');
            };

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-[22px] border border-white bg-white shadow-[0_10px_28px_rgba(33,52,78,0.055)] [content-visibility:auto] [contain-intrinsic-size:184px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
                style={{ animationDelay: `${Math.min(orderIndex, 3) * 24}ms` }}
              >
                <header className="flex items-start justify-between gap-3 px-3.5 pb-2.5 pt-3.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-[#F0F5FB] text-[#56779F]">
                      <Store className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-black text-slate-800">{order.supplierName || order.mallName}</span>
                      <span className="mt-0.5 block truncate font-mono text-[8px] tracking-[-0.01em] text-slate-400">{order.orderNo} · {order.createdAt}</span>
                    </span>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1.5 pt-1 text-[10px] font-bold ${statusTone.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} />
                    {displayStatusText}
                  </span>
                </header>

                <button type="button" onClick={() => openOrderView(order, 'detail')} className="flex w-full touch-manipulation items-center gap-3 border-t border-slate-100/80 px-3.5 py-3 text-left transition-[background-color,transform] duration-150 active:scale-[0.995] active:bg-[#F7F9FC]">
                  {firstItem ? (
                    <img
                      src={storefrontImageUrl(firstItem.product.imageUrl, 144)}
                      srcSet={`${storefrontImageUrl(firstItem.product.imageUrl, 72)} 1x, ${storefrontImageUrl(firstItem.product.imageUrl, 144)} 2x, ${storefrontImageUrl(firstItem.product.imageUrl, 216)} 3x`}
                      alt={firstItem.productTitle}
                      width={72}
                      height={72}
                      loading={orderIndex === 0 ? 'eager' : 'lazy'}
                      fetchPriority={orderIndex === 0 ? 'high' : 'low'}
                      decoding="async"
                      className="h-[72px] w-[72px] shrink-0 rounded-[16px] bg-[#F5F7FA] object-cover"
                    />
                  ) : (
                    <span className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-[16px] bg-[#F0F4F8] text-[#7C91AB]"><Package className="h-5 w-5" /></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[11px] font-bold leading-[1.55] text-slate-800">{firstItem?.productTitle ?? '订单商品信息同步中'}</span>
                    <span className="mt-1 block text-[9px] text-slate-400">
                      {firstItem?.specText || '默认规格'} · 共 {itemCount} 件{order.items.length > 1 ? ` · ${order.items.length} 种商品` : ''}
                    </span>
                    <span className="mt-2 flex items-center gap-1.5 text-[9px] font-medium text-[#607B9B]">
                      <Package className="h-3 w-3 shrink-0" />
                      <span className="truncate">{packages.length > 1 ? `${packages.length} 个包裹 · 分别配送` : mobileOrderProgressHint(order.status, fulfillmentStage)}</span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>

                <footer className="flex min-h-[54px] items-center justify-between gap-3 border-t border-slate-100/80 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[8px] tracking-wide text-slate-400">{isPendingPayment ? '待支付' : '实付金额'}</p>
                    <p className={`mt-0.5 text-[16px] font-black tracking-[-0.03em] ${isPendingPayment ? 'text-[#D9544F]' : 'text-slate-900'}`}>¥{displayAmount.toFixed(2)}</p>
                  </div>
                  <button type="button" onClick={runPrimaryAction} className={`flex min-h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-full px-4 text-[10px] font-bold transition-transform duration-150 active:scale-95 ${mobileOrderActionTone(primaryAction.tone)}`}>
                    {primaryAction.kind === 'payment' && <WalletCards className="h-3.5 w-3.5" />}
                    {primaryAction.kind === 'after-sale' && <RotateCcw className="h-3.5 w-3.5" />}
                    {primaryAction.kind === 'detail' && <Truck className="h-3.5 w-3.5" />}
                    {primaryAction.label}
                  </button>
                </footer>
              </article>
            );
          })
        )}
      </main>
      {paymentSheet}
    </div>
  );
};

type MobileOrderAction = Readonly<{
  kind: 'payment' | 'after-sale' | 'detail';
  label: string;
  tone: 'brand' | 'quiet' | 'service';
}>;

function mobileOrderPrimaryAction(status: FrontendOrder['status'], fulfillmentStage: MobileFulfillmentStage | null): MobileOrderAction {
  if (status === 'pending_payment' || status === 'pending_pay') return { kind: 'payment', label: '继续付款', tone: 'brand' };
  if (status === 'after_sale') return { kind: 'after-sale', label: '查看进度', tone: 'service' };
  if (status === 'completed' || fulfillmentStage === 'received') return { kind: 'after-sale', label: '退货/退款', tone: 'quiet' };
  if (fulfillmentStage === 'shipped') return { kind: 'detail', label: '查看物流', tone: 'brand' };
  if (fulfillmentStage === 'processing') return { kind: 'after-sale', label: '申请退款', tone: 'quiet' };
  return { kind: 'detail', label: '订单详情', tone: 'quiet' };
}

function mobileOrderActionTone(tone: MobileOrderAction['tone']): string {
  if (tone === 'brand') return 'bg-[var(--sw-brand)] text-white shadow-[0_7px_16px_rgba(36,105,232,0.2)]';
  if (tone === 'service') return 'bg-[#F1EEFB] text-[#6E5B9C]';
  return 'border border-[#D9E2ED] bg-white text-slate-700';
}

function orderStatusTone(status: FrontendOrder['status'], fulfillmentStage: MobileFulfillmentStage | null): Readonly<{ text: string; dot: string }> {
  if (status === 'pending_payment' || status === 'pending_pay') return { text: 'text-amber-700', dot: 'bg-amber-500' };
  if (status === 'after_sale') return { text: 'text-[#725EA1]', dot: 'bg-[#8A76B7]' };
  if (status === 'completed' || fulfillmentStage === 'received') return { text: 'text-emerald-700', dot: 'bg-emerald-500' };
  return { text: 'text-[#4E7098]', dot: 'bg-[#6F91B8]' };
}

function mobileOrderProgressHint(status: FrontendOrder['status'], fulfillmentStage: MobileFulfillmentStage | null): string {
  if (status === 'pending_payment' || status === 'pending_pay') return '等待完成支付';
  if (status === 'after_sale') return '售后进度持续更新';
  if (status === 'completed' || fulfillmentStage === 'received') return '包裹已完成签收';
  if (fulfillmentStage === 'shipped') return '包裹运输中';
  return '商户正在备货';
}

function mobileOrderEmptyState(filter: MobileOrderFilter, activeLabel: string): Readonly<{ title: string; detail: string }> {
  if (filter === 'pending_payment') return { title: '没有等待付款的订单', detail: '需要继续付款的订单会出现在这里。' };
  if (filter === 'pending_shipment') return { title: `暂无${activeLabel}订单`, detail: '备货、运输与收货进度会自动同步。' };
  if (filter === 'completed') return { title: '还没有已完成订单', detail: '签收完成的订单会安静地留在这里。' };
  if (filter === 'after_sale') return { title: '暂无售后申请', detail: '退货、退款与审核进度会集中展示。' };
  return { title: '还没有订单', detail: '下单后，每一步进度都会在这里更新。' };
}
