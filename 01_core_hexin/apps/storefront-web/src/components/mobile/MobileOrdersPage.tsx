import React from 'react';
import { ChevronLeft, Eye, RotateCcw, Store, WalletCards } from 'lucide-react';
import type { FrontendOrder } from '../../adapters/frontendData';
import { useMall } from '../../context/MallContext';
import { storefrontImageUrl } from '../../services/storefrontImageUrl';
import { MobileAfterSaleView } from './MobileAfterSaleView';
import { MobileInventoryBadge } from './MobileInventoryBadge';
import { MobileOrderDetailView } from './MobileOrderDetailView';
import { MobilePaymentSheet } from './MobilePaymentSheet';
import { OrderFlowIcon } from './OrderFlowIcon';
import { currentMobileOrderFilter, matchesMobileOrderFilter, selectMobileOrderFilter, type MobileOrderFilter } from './mobileOrderFilters';

interface MobileOrdersPageProps {
  mode: 'mini-program' | 'android-app';
}

const FILTER_OPTIONS: ReadonlyArray<Readonly<{ id: MobileOrderFilter; label: string }>> = [
  { id: 'all', label: '全部' },
  { id: 'pending_payment', label: '待付款' },
  { id: 'pending_shipment', label: '待处理' },
  { id: 'completed', label: '已完成' },
  { id: 'after_sale', label: '售后' },
];

export const MobileOrdersPage: React.FC<MobileOrdersPageProps> = ({ mode }) => {
  const { presentationOrders, setMpPage, setAndroidPage, triggerPendingFeature } = useMall();
  const [activeFilter, setActiveFilter] = React.useState<MobileOrderFilter>(() => currentMobileOrderFilter());
  const [selectedOrder, setSelectedOrder] = React.useState<FrontendOrder | null>(null);
  const [orderView, setOrderView] = React.useState<'list' | 'detail' | 'after-sale'>('list');
  const [paymentOrder, setPaymentOrder] = React.useState<FrontendOrder | null>(null);
  const visibleOrders = React.useMemo(
    () => presentationOrders.filter((order) => matchesMobileOrderFilter(order.status, activeFilter)),
    [activeFilter, presentationOrders],
  );
  const filterCounts = React.useMemo(() => Object.fromEntries(FILTER_OPTIONS.map((option) => [
    option.id,
    presentationOrders.filter((order) => matchesMobileOrderFilter(order.status, option.id)).length,
  ])) as Record<MobileOrderFilter, number>, [presentationOrders]);
  const activeLabel = FILTER_OPTIONS.find((option) => option.id === activeFilter)?.label ?? '全部';

  const chooseFilter = (filter: MobileOrderFilter) => {
    selectMobileOrderFilter(filter);
    setActiveFilter(filter);
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
    <div className="relative min-h-full bg-[#F5F7FA] pb-20 text-gray-800">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-3 py-3 backdrop-blur">
        <button type="button" onClick={goBack} className="rounded-full p-1.5 hover:bg-gray-100" aria-label="返回个人中心">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[var(--sw-brand)]">
          <OrderFlowIcon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-sm font-black">订单管理</h1>
          <p className="text-[10px] text-gray-500">查看付款、履约与售后进度</p>
        </div>
      </header>

      <main className="space-y-3 p-3">
        <nav aria-label="订单状态筛选" className="grid grid-cols-5 gap-1 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xs">
          {FILTER_OPTIONS.map((option) => {
            const count = filterCounts[option.id];
            const isActive = option.id === activeFilter;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => chooseFilter(option.id)}
                className={`flex min-h-9 items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-bold transition-colors ${isActive ? 'bg-[var(--sw-brand)] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 active:bg-blue-50'}`}
              >
                <span>{option.label}</span>
                {count > 0 && <span className={isActive ? 'text-blue-100' : 'text-gray-400'}>{count > 99 ? '99+' : count}</span>}
              </button>
            );
          })}
        </nav>

        {visibleOrders.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-[var(--sw-brand)]">
              <OrderFlowIcon className="h-11 w-11" />
            </div>
            <p className="text-sm font-bold">{activeFilter === 'all' ? '暂无订单' : `暂无${activeLabel}订单`}</p>
            <p className="mt-1 text-[11px] text-gray-500">新的订单进度会在这里及时出现。</p>
          </div>
        ) : (
          visibleOrders.map((order, orderIndex) => {
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const isPendingPayment = order.status === 'pending_payment' || order.status === 'pending_pay';
            const isCompleted = order.status === 'completed';
            const isAfterSale = order.status === 'after_sale';
            const displayAmount = isPendingPayment && order.payment.wechatPaid > 0 ? order.payment.wechatPaid : order.totalAmount;

            return (
              <article key={order.id} className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm [content-visibility:auto] [contain-intrinsic-size:190px]">
                <header className="flex items-start justify-between gap-3 px-3.5 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-[var(--sw-brand)]">
                      <Store className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-gray-900">{order.supplierName || order.mallName}</p>
                      <p className="mt-0.5 truncate font-mono text-[9px] text-gray-400">{order.orderNo} · {order.createdAt}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${orderStatusTone(order.status)}`}>
                    {order.statusText}
                  </span>
                </header>

                <div className="mx-3 rounded-2xl bg-[#F7F9FC] px-2.5 py-2.5">
                  <div className="space-y-2.5">
                    {order.items.slice(0, 2).map((item, itemIndex) => {
                      const isPriorityImage = orderIndex === 0 && itemIndex === 0;
                      return (
                      <div key={`${order.id}-${item.productId}`} className="flex items-center gap-2.5">
                        <img
                          src={storefrontImageUrl(item.product.imageUrl, 112)}
                          srcSet={`${storefrontImageUrl(item.product.imageUrl, 56)} 1x, ${storefrontImageUrl(item.product.imageUrl, 112)} 2x, ${storefrontImageUrl(item.product.imageUrl, 168)} 3x`}
                          alt={item.productTitle}
                          width={56}
                          height={56}
                          loading={isPriorityImage ? 'eager' : 'lazy'}
                          fetchPriority={isPriorityImage ? 'high' : 'low'}
                          decoding="async"
                          className="h-14 w-14 shrink-0 rounded-xl border border-white bg-white object-cover shadow-xs"
                        />
                        <div className="min-w-0 flex-1 self-stretch py-0.5">
                          <p className="line-clamp-2 text-[11px] font-bold leading-[1.45] text-gray-800">{item.productTitle}</p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <MobileInventoryBadge product={item.product} />
                            <span className="text-[10px] text-gray-400">× {item.quantity}</span>
                          </div>
                          <div className="mt-1 flex items-end justify-between gap-2">
                            <span className="text-xs font-black text-gray-900">¥{item.priceAtPurchase.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                  {order.items.length > 2 && (
                    <p className="mt-2 border-t border-white pt-2 text-right text-[9px] text-gray-400">另有 {order.items.length - 2} 种商品</p>
                  )}
                </div>

                <footer className="border-t border-gray-50 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span>共 {itemCount} 件</span>
                      {isAfterSale && <span className="font-medium text-purple-600">售后处理中</span>}
                    </div>
                    <span className="text-[10px] text-gray-500">{isPendingPayment ? '待支付' : '实付'} <strong className="ml-0.5 text-base font-black text-[#E5484D]">¥{displayAmount.toFixed(2)}</strong></span>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => openOrderView(order, 'detail')} className="flex min-h-8 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 text-[9px] font-bold text-gray-600 active:bg-gray-50"><Eye className="h-3 w-3" />订单详情</button>
                    {isPendingPayment && <button type="button" onClick={() => setPaymentOrder(order)} className="flex min-h-8 items-center gap-1 rounded-full bg-[var(--sw-brand)] px-3.5 text-[9px] font-bold text-white"><WalletCards className="h-3 w-3" />继续付款</button>}
                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => openOrderView(order, 'after-sale')}
                        className="flex min-h-8 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 text-[9px] font-bold text-gray-700 active:bg-gray-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        退货/退款
                      </button>
                    )}
                    {isAfterSale && <button type="button" onClick={() => openOrderView(order, 'after-sale')} className="min-h-8 rounded-full bg-purple-50 px-3 text-[9px] font-bold text-purple-700">查看进度</button>}
                  </div>
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

function orderStatusTone(status: string): string {
  if (status === 'pending_payment' || status === 'pending_pay') return 'bg-amber-50 text-amber-700';
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700';
  if (status === 'after_sale') return 'bg-purple-50 text-purple-700';
  return 'bg-blue-50 text-[var(--sw-brand)]';
}
