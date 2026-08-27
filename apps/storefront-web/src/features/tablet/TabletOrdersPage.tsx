import React, { useState } from 'react';
import { useMall } from '../../context/MallContext';
import { FileText, Clock, Truck, CheckCircle, HelpCircle, ChevronRight, ShieldCheck, CreditCard, Utensils, MapPin, Headphones, Download, Building2, Copy, Info } from 'lucide-react';

export const TabletOrdersPage: React.FC = () => {
  const { user, triggerPendingFeature, presentationOrders: MOCK_ORDERS } = useMall();

  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(MOCK_ORDERS[0]?.id || 'ord_001');

  const filteredOrders = activeStatus === 'all' ? MOCK_ORDERS : MOCK_ORDERS.filter((o) => o.status === activeStatus);

  const selectedOrder = MOCK_ORDERS.find((o) => o.id === selectedOrderId) || MOCK_ORDERS[0];

  return (
    <div className="bg-[#F5F7FA] h-full flex font-sans text-gray-800 overflow-hidden">
      {/* LEFT COLUMN: Master Order List (~40%) */}
      <div className="w-[40%] p-4 overflow-y-auto space-y-3 border-r border-gray-200 bg-white">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold border-b border-gray-100">
          {[
            { key: 'all', label: '全部订单' },
            { key: 'pending_payment', label: '待付款' },
            { key: 'pending_shipment', label: '待发货' },
            { key: 'pending_receipt', label: '待收货' },
            { key: 'completed', label: '已完成' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={`px-3 py-2 rounded-xl whitespace-nowrap transition-colors cursor-pointer min-h-[38px] ${activeStatus === tab.key ? 'bg-[var(--sw-brand)] text-white shadow-2xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Master Order Items */}
        <div className="space-y-2">
          {filteredOrders.map((order) => {
            const isSelected = order.id === selectedOrderId;
            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${isSelected ? 'border-[var(--sw-brand)] bg-blue-50/70 shadow-xs' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-900 font-mono">订单: {order.orderNo}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-black ${
                      order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : order.status === 'pending_receipt' ? 'bg-blue-100 text-[var(--sw-brand)]' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {order.statusText}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <img key={idx} src={item.product.imageUrl} alt={item.product.title} className="w-12 h-12 object-cover rounded-xl border border-gray-200 flex-shrink-0" />
                  ))}
                  {order.items.length > 3 && <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs flex items-center justify-center">+{order.items.length - 3}</div>}
                </div>

                <div className="flex items-center justify-between text-xs border-t border-gray-100/60 pt-2 font-mono">
                  <span className="text-gray-400 text-[10px]">{order.createdAt}</span>
                  <span className="font-black text-[#E5484D]">总计: ¥{order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Order Detail Pane (~60%) */}
      <div className="w-[60%] p-5 overflow-y-auto space-y-4 bg-[#F5F7FA]">
        {selectedOrder ? (
          <>
            {/* Header Status & Order Info */}
            <div className="bg-gradient-to-r from-[var(--sw-brand-dark)] to-[var(--sw-brand)] text-white p-4 rounded-3xl shadow-sm flex items-center justify-between">
              <div>
                <div className="text-[10px] text-blue-200 uppercase font-black tracking-wider">企采履约状态</div>
                <div className="text-lg font-black mt-0.5">{selectedOrder.statusText}</div>
                <div className="text-xs text-blue-100 font-mono mt-1">单号：{selectedOrder.orderNo}</div>
              </div>

              <button
                onClick={() => triggerPendingFeature('复制订单号', '已将订单编号复制至剪贴板。')}
                className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer border border-white/20 min-h-[38px]"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>复制单号</span>
              </button>
            </div>

            {/* Product List Card */}
            <div className="bg-white rounded-3xl p-4 shadow-2xs border border-gray-200 space-y-3">
              <div className="text-xs font-black text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
                <span>企采商品清单 ({selectedOrder.items.length})</span>
                <span className="text-[10px] text-gray-400">专票合规开票</span>
              </div>

              <div className="space-y-2.5">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs border-b border-gray-50 pb-2">
                    <img src={item.product.imageUrl} alt={item.product.title} className="w-14 h-14 object-cover rounded-2xl border border-gray-100 flex-shrink-0" />
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold text-gray-900 truncate">{item.product.title}</div>
                      <div className="text-[10px] text-gray-400">数量 x{item.quantity}</div>
                    </div>
                    <div className="font-mono font-bold text-[#E5484D] text-right">¥{(item.product.price * item.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Timeline Card */}
            <div className="bg-white rounded-3xl p-4 shadow-2xs border border-gray-200 space-y-3">
              <div className="text-xs font-black text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                <Truck className="w-4 h-4 text-[var(--sw-brand)]" />
                <span>物流履约轨迹</span>
              </div>

              <div className="space-y-3 text-xs pl-2 border-l-2 border-blue-200 ml-2">
                <div className="relative pl-4 space-y-0.5">
                  <div className="absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full bg-[var(--sw-brand)] ring-4 ring-blue-100" />
                  <div className="font-bold text-gray-900">企采专线统仓已派发出库</div>
                  <div className="text-[10px] text-gray-400 font-mono">2026-07-24 10:30:00</div>
                </div>

                <div className="relative pl-4 space-y-0.5">
                  <div className="absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full bg-gray-300" />
                  <div className="font-bold text-gray-600">已开具电子增值税发票</div>
                  <div className="text-[10px] text-gray-400 font-mono">2026-07-24 09:15:00</div>
                </div>
              </div>
            </div>

            {/* Payment & Invoice Breakdown */}
            <div className="bg-white rounded-3xl p-4 shadow-2xs border border-gray-200 space-y-2 text-xs">
              <div className="text-xs font-black text-gray-900 border-b border-gray-100 pb-2">扣款与发票详情</div>

              <div className="space-y-1.5 text-gray-600">
                <div className="flex justify-between">
                  <span>福利卡抵扣:</span>
                  <span className="font-mono font-bold text-amber-600">-¥{selectedOrder.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>开票抬头:</span>
                  <span className="font-bold text-gray-800">中国建筑集团有限公司</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => triggerPendingFeature('平板电子发票下载', '调起 PDF 格式增值税电子发票。')}
                className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-bold text-xs py-3 rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs min-h-[44px]"
              >
                <Download className="w-4 h-4 text-[var(--sw-brand)]" />
                <span>下载电子发票</span>
              </button>

              <button
                onClick={() => triggerPendingFeature('平板售后服务', '申请企采换货或补发。')}
                className="flex-1 bg-[var(--sw-brand)] hover:bg-blue-600 text-white font-bold text-xs py-3 rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md min-h-[44px]"
              >
                <Headphones className="w-4 h-4" />
                <span>企采专属售后</span>
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-24 text-gray-400 text-xs">请从左侧选择订单查看详情</div>
        )}
      </div>
    </div>
  );
};
