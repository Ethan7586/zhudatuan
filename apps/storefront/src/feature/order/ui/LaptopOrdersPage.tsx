import React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useOrderRuntime } from '../application/OrderRuntime';
import { ProductMedia } from '../../../shared/ui/ProductMedia';
import type { LaptopPage } from '../../../shared/manifest/StorefrontRoute';
import { FileText, Truck } from 'lucide-react';
import { STOREFRONT_WEB_SURFACE_COPY, type StorefrontWebSurface } from '../../../shared/ui/StorefrontPresentation';
import { paymentStateText } from '../model/OrderText';

interface LaptopOrdersPageProps {
  onSelectTab: (tab: LaptopPage) => void;
  surface?: StorefrontWebSurface;
  onAfterSale: (orderId: string) => void;
}

export const LaptopOrdersPage: React.FC<LaptopOrdersPageProps> = ({ onSelectTab: _onSelectTab, onAfterSale, surface = 'standard' }) => {
  const { navigateTo, presentationOrders: orders } = useOrderRuntime();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const surfaceCopy = STOREFRONT_WEB_SURFACE_COPY[surface];
  const activeStatus = search.get('status') ?? 'all';

  const filteredOrders = orders.filter((o) => {
    if (activeStatus === 'all') return true;
    if (activeStatus === 'pending_payment') return o.status === 'pending_payment';
    if (activeStatus === 'shipping') return o.status === 'pending_shipment' || o.status === 'pending_receipt';
    if (activeStatus === 'pending_shipment' || activeStatus === 'pending_receipt' || activeStatus === 'after_sale') return o.status === activeStatus;
    if (activeStatus === 'completed') return o.status === 'completed';
    return true;
  });

  return (
    <div className="w-full bg-[var(--sw-background)] min-h-[80vh] pb-8 font-sans">
      <div className="sw-web-container max-w-[1240px] mx-auto pt-3 px-3 space-y-3">
        {/* 页头标题 */}
        <div className="flex items-center justify-between text-xs border-b border-gray-200 pb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--sw-brand)]" />
            <h1 className="font-extrabold text-sm text-gray-900">员工福利订单中心</h1>
          </div>
          <span className="text-gray-400">{surfaceCopy.ordersLayoutLabel}</span>
        </div>

        {/* 订单筛选与主表格两栏 */}
        <div className="sw-web-orders-grid grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
          {/* 左侧状态导航 (3列) */}
          <div className="sw-web-orders-sidebar md:col-span-3 bg-white border border-gray-200 rounded-lg p-2.5 shadow-2xs space-y-1 text-xs">
            <div className="font-bold text-gray-800 pb-2 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400">订单状态筛选</div>

            {[
              { id: 'all', name: '全部企采订单', count: orders.length },
              { id: 'pending_payment', name: '待付款 / 待划扣', count: orders.filter((order) => order.status === 'pending_payment').length },
              { id: 'shipping', name: '待发货 / 运输中', count: orders.filter((order) => order.status === 'pending_shipment' || order.status === 'pending_receipt').length },
              { id: 'completed', name: '已完成订单', count: orders.filter((order) => order.status === 'completed').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  const next = new URLSearchParams(search);
                  if (tab.id === 'all') next.delete('status');
                  else next.set('status', tab.id);
                  next.delete('view');
                  setSearch(next);
                }}
                className={`w-full text-left px-2.5 py-2 rounded font-bold cursor-pointer transition-colors flex items-center justify-between ${activeStatus === tab.id ? 'bg-[var(--sw-brand)] text-white' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <span>{tab.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeStatus === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{tab.count}</span>
              </button>
            ))}

            <button type="button" onClick={() => void navigate('/orders?view=invoices')} className="w-full border-t border-gray-100 pt-2 text-left text-[10px] font-bold text-[var(--sw-brand)]">
              查看真实开票记录与下载电子发票
            </button>
          </div>

          {/* 右侧订单卡片列表 (9列) */}
          <div className="sw-web-orders-list md:col-span-9 space-y-2.5">
            {filteredOrders.map((order) => (
              <div key={order.orderId} className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden text-xs">
                {/* 订单头部信息 */}
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between text-[11px] text-gray-600 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900">订单号: {order.orderNo}</span>
                    <span>下单时间: {order.createdAt}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--sw-promotion)]">{order.statusText}</span>
                  </div>
                </div>

                {/* 订单商品列表 */}
                <div className="p-3 divide-y divide-gray-100">
                  {order.items.map((item) => (
                    <div key={item.product.id} className="py-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 bg-gray-50 border border-gray-200 rounded p-1 flex-shrink-0 flex items-center justify-center">
                          <ProductMedia
                            source={item.product.image}
                            alt={item.product.title}
                            className="max-h-full max-w-full object-contain"
                            emptyClassName="text-center text-[9px] text-gray-400"
                            emptyText="暂无图片"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-800 truncate text-xs">{item.product.title}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            SKU：{item.skuId} × {item.quantity}
                          </div>
                          {item.partner || item.provider ? <div className="text-[10px] text-gray-400 mt-0.5">履约方：{item.partner ?? item.provider}</div> : null}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-gray-900">¥{item.priceAtPurchase.toFixed(2)}</div>
                        <div className="text-[10px] text-gray-400">SKU：{item.skuId}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 订单底部扣减与操作栏 */}
                <div className="bg-gray-50/60 p-2.5 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>
                      总额: <strong className="text-gray-900">¥{order.totalAmount.toFixed(2)}</strong>
                    </span>
                    <span>·</span>
                    <span className="text-[var(--sw-brand-dark)] font-bold">支付状态：{paymentStateText(order.paymentState)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onAfterSale(order.orderId)} className="rounded border border-gray-300 bg-white px-2.5 py-1 font-bold text-gray-700 hover:border-[var(--sw-brand)] hover:text-[var(--sw-brand)]">
                      售后与退款
                    </button>
                    <button
                      onClick={() => void navigate('/orders?view=invoices')}
                      className="bg-white border border-gray-300 hover:border-[var(--sw-brand)] text-gray-700 hover:text-[var(--sw-brand)] font-bold px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-[var(--sw-brand)]" />
                      <span>查看电子发票</span>
                    </button>

                    <button
                      onClick={() => navigateTo('orders', { orderId: order.orderId })}
                      className="bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>查看物流状态</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredOrders.length === 0 ? <div className="grid min-h-48 place-items-center rounded-lg border border-dashed bg-white text-gray-400">当前状态暂无订单</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
};
