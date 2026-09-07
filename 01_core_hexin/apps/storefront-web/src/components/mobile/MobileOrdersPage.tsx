import React from 'react';
import { ChevronLeft, RotateCcw, Store } from 'lucide-react';
import { useMall } from '../../context/MallContext';
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
  const visibleOrders = presentationOrders.filter((order) => matchesMobileOrderFilter(order.status, activeFilter));
  const activeLabel = FILTER_OPTIONS.find((option) => option.id === activeFilter)?.label ?? '全部';

  const chooseFilter = (filter: MobileOrderFilter) => {
    selectMobileOrderFilter(filter);
    setActiveFilter(filter);
  };

  const goBack = () => {
    if (mode === 'mini-program') setMpPage('profile');
    else setAndroidPage('profile');
  };

  return (
    <div className="min-h-full bg-[#F5F7FA] pb-20 text-gray-800">
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
            const count = presentationOrders.filter((order) => matchesMobileOrderFilter(order.status, option.id)).length;
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
          visibleOrders.map((order) => {
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const isCompleted = order.status === 'completed';
            const isAfterSale = order.status === 'after_sale';

            return (
              <article key={order.id} className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
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
                    {order.items.slice(0, 2).map((item) => (
                      <div key={`${order.id}-${item.productId}`} className="flex items-center gap-2.5">
                        <img src={item.product.imageUrl} alt={item.productTitle} className="h-14 w-14 shrink-0 rounded-xl border border-white bg-white object-cover shadow-xs" />
                        <div className="min-w-0 flex-1 self-stretch py-0.5">
                          <p className="line-clamp-2 text-[11px] font-bold leading-[1.45] text-gray-800">{item.productTitle}</p>
                          <div className="mt-1.5 flex items-end justify-between gap-2">
                            <span className="text-xs font-black text-gray-900">¥{item.priceAtPurchase.toFixed(2)}</span>
                            <span className="text-[10px] text-gray-400">× {item.quantity}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {order.items.length > 2 && (
                    <p className="mt-2 border-t border-white pt-2 text-right text-[9px] text-gray-400">另有 {order.items.length - 2} 种商品</p>
                  )}
                </div>

                <footer className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span>共 {itemCount} 件</span>
                    {isAfterSale && <span className="font-medium text-purple-600">售后处理中</span>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] text-gray-500">实付 <strong className="ml-0.5 text-base font-black text-[#E5484D]">¥{order.totalAmount.toFixed(2)}</strong></span>
                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => triggerPendingFeature('移动端售后申请', `订单 ${order.orderNo} 已接入统一售后数据模型；退款审批仍需甲方确认流程。`)}
                        className="flex min-h-8 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 text-[10px] font-bold text-gray-700 active:bg-gray-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        申请售后
                      </button>
                    )}
                  </div>
                </footer>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
};

function orderStatusTone(status: string): string {
  if (status === 'pending_payment' || status === 'pending_pay') return 'bg-amber-50 text-amber-700';
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700';
  if (status === 'after_sale') return 'bg-purple-50 text-purple-700';
  return 'bg-blue-50 text-[var(--sw-brand)]';
}
