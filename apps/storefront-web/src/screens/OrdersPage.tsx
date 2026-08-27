/**
 * 智慧翼企业福利商城 - 我的订单列表页 OrdersPage screen
 * 包含状态筛选、快速查看物流单号/虚拟券码、子订单拆单标记与确认收货/售后入口
 * 技术服务方：雍彻科技
 */

import React, { useState, useMemo } from 'react';
import { useMall } from '../context/MallContext';
import { OrderStatus } from '../types';
import { Package, Search, Truck, QrCode, ChevronRight, Clock, Headphones } from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const { navigateTo, showToast, orders, routeParams } = useMall();

  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>(routeParams.statusFilter || 'all');
  const [searchKw, setSearchKw] = useState('');

  const statusTextMap: Record<string, string> = {
    pending_payment: '待付款',
    pending_shipment: '待发货 / 仓库配货中',
    pending_receipt: '已发货 / 待收货',
    completed: '已完成',
    after_sale: '售后维权处理中',
  };
  const statusEta: Record<OrderStatus, string> = {
    pending_payment: '待付款超时将自动释放库存',
    pending_shipment: '提交后 24 小时内排单',
    pending_receipt: '预计 24-72 小时送达',
    completed: '已完成签收',
    after_sale: '工单处理中，通常 4-8 小时',
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 状态过滤
      if (activeTab !== 'all' && order.status !== activeTab) {
        return false;
      }

      // 关键词过滤
      if (searchKw.trim()) {
        const kw = searchKw.trim().toLowerCase();
        const matchNo = order.orderNo.toLowerCase().includes(kw);
        const matchTitle = order.items.some((i) => i.productTitle.toLowerCase().includes(kw));
        return matchNo || matchTitle;
      }

      return true;
    });
  }, [orders, activeTab, searchKw]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast(`核销码已复制: ${code}`, 'success');
  };

  const handleConfirmReceipt = (orderId: string) => {
    const order = orders.find((candidate) => candidate.id === orderId);
    showToast(order ? `订单 ${order.orderNo} 的确认收货接口尚未接通，当前未修改数据库状态` : '订单不存在', 'warning');
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-4 font-sans text-xs">
      {/* 1. 顶部 Tab 状态筛选 */}
      <div className="bg-white border border-gray-200 rounded-md p-2 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1 font-bold">
          {[
            { id: 'all', label: '全部订单' },
            { id: 'pending_payment', label: '待付款' },
            { id: 'pending_shipment', label: '待发货/排单' },
            { id: 'pending_receipt', label: '待收货' },
            { id: 'completed', label: '已完成' },
            { id: 'after_sale', label: '售后/退款' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded transition-colors cursor-pointer whitespace-nowrap ${isActive ? 'bg-[var(--sw-brand)] text-white font-black' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 检索框 */}
        <div className="relative min-w-[220px]">
          <input type="text" placeholder="搜索订单号或商品名称..." value={searchKw} onChange={(e) => setSearchKw(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded bg-gray-50 text-xs focus:outline-none" />
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
        </div>
      </div>

      {/* 2. 订单列表 */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-12 text-center space-y-3">
          <Package className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-700">没有查找到符合条件的订单</h3>
          <p className="text-xs text-gray-400">您可以切换筛选标签或去商城首页选购福利商品。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-md shadow-xs overflow-hidden text-xs">
              {/* 订单 Header */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between text-gray-600">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">下单时间：{order.createTime}</span>
                  <span>·</span>
                  <span className="font-mono">订单号：{order.orderNo}</span>
                  <span>·</span>
                  <span className="bg-blue-100 text-[var(--sw-brand)] font-bold px-1.5 py-0.2 rounded text-[10px]">{order.supplierName}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      order.status === 'completed'
                        ? 'bg-gray-100 text-gray-700'
                        : order.status === 'pending_shipment'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'pending_receipt'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {statusTextMap[order.status] || order.status}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>预计：{statusEta[order.status] || '平台处理中'}</span>
                </div>
              </div>

              {/* 订单内商品 */}
              <div className="p-4 space-y-3">
                {order.items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img src={item.productImage} alt="" className="w-16 h-16 rounded object-cover border border-gray-200 cursor-pointer" onClick={() => navigateTo('order-detail', { orderId: order.id })} />
                      <div className="space-y-1">
                        <div onClick={() => navigateTo('order-detail', { orderId: order.id })} className="font-bold text-gray-900 hover:text-[var(--sw-brand)] cursor-pointer">
                          {item.productTitle}
                        </div>
                        <div className="text-gray-400 text-[11px]">规格：{item.specText}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-gray-900">¥{item.price.toFixed(2)}</div>
                      <div className="text-gray-400 text-[11px]">× {item.quantity} 件</div>
                    </div>
                  </div>
                ))}

                {/* 物流单号 / 虚拟核销码展示 */}
                {order.trackingNo && (
                  <div className="bg-blue-50/60 border border-blue-200 rounded p-2.5 text-blue-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600" />
                      <span>
                        承运物流：<strong>{order.expressCompany}</strong> (运单号: <strong className="font-mono">{order.trackingNo}</strong>)
                      </span>
                    </div>
                    <button onClick={() => navigateTo('order-detail', { orderId: order.id })} className="text-[var(--sw-brand)] font-bold hover:underline cursor-pointer">
                      查看物流轨迹 &gt;
                    </button>
                  </div>
                )}

                {order.verificationCode && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-amber-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-amber-600" />
                      <span>
                        电子核销码：
                        <strong className="font-mono font-black text-amber-800 text-sm">{order.verificationCode}</strong>
                      </span>
                    </div>
                    <button onClick={() => copyCode(order.verificationCode!)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] px-2.5 py-1 rounded cursor-pointer">
                      复制核销码
                    </button>
                  </div>
                )}
              </div>

              {/* 底部费用明细与操作按钮栏 */}
              <div className="bg-gray-50 border-t border-gray-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-gray-500 text-[11px] space-x-3">
                  <span>
                    实付总额: <strong className="text-gray-900 text-sm font-black">¥{order.payment.finalPaidAmount.toFixed(2)}</strong>
                  </span>
                  <span>
                    (福利卡扣: ¥{order.payment.welfareDeducted.toFixed(2)} | 餐卡扣: ¥{order.payment.mealDeducted.toFixed(2)})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => navigateTo('order-detail', { orderId: order.id })} className="border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold px-3 py-1.5 rounded cursor-pointer">
                    订单详情
                  </button>

                  {order.status === 'pending_receipt' && (
                    <button onClick={() => handleConfirmReceipt(order.id)} className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded cursor-pointer">
                      确认收货
                    </button>
                  )}

                  {order.status === 'completed' && (
                    <button onClick={() => navigateTo('after-sale', { orderId: order.id })} className="border border-orange-300 text-orange-700 hover:bg-orange-50 font-bold px-3 py-1.5 rounded cursor-pointer">
                      申请售后
                    </button>
                  )}

                  {order.status === 'pending_shipment' && (
                    <button onClick={() => showToast(`订单 ${order.orderNo} 已提交催单，客服将于1个工作日内联系商家`, 'info')} className="border border-blue-300 text-blue-700 hover:bg-blue-50 font-bold px-3 py-1.5 rounded cursor-pointer">
                      催单
                    </button>
                  )}

                  {order.status !== 'completed' && order.status !== 'after_sale' && order.status !== 'pending_receipt' ? (
                    <button onClick={() => showToast('客服工单将由专员在 24h 内回访，联系电话：010-6666-9999', 'info')} className="border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold px-3 py-1.5 rounded cursor-pointer">
                      <Headphones className="w-3.5 h-3.5 inline-block mr-1" />
                      联系客服
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
