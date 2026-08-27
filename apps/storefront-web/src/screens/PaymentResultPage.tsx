/**
 * 智慧翼企业福利商城 - 支付与提交结果页 PaymentResultPage screen
 * 展示订单成功提单状态、多供应商拆单子订单号、卡券核销码与福利账户扣减结果
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { useMall } from '../context/MallContext';
import { CheckCircle2, Package, CreditCard, Ticket, ChevronRight, ArrowLeft, Building2, QrCode, Copy, Receipt } from 'lucide-react';

export const PaymentResultPage: React.FC = () => {
  const { routeParams, navigateTo, user, showToast, orders: accountOrders } = useMall();

  const parentOrderNo = routeParams.parentOrderNo;

  const orders = parentOrderNo ? accountOrders.filter((order) => order.parentOrderNo === parentOrderNo || order.orderNo === parentOrderNo) : [];

  if (!parentOrderNo || orders.length === 0) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-20 text-center">
        <Package className="mx-auto h-10 w-10 text-gray-400" />
        <h1 className="mt-4 text-lg font-bold text-gray-900">尚未取得订单结果</h1>
        <p className="mt-2 text-sm text-gray-500">只有数据库返回并能在当前账户订单中核对到的订单，才会显示支付成功。</p>
        <button onClick={() => navigateTo('orders')} className="mt-5 rounded-lg bg-[var(--sw-brand)] px-5 py-2 text-sm font-bold text-white">
          查看真实订单
        </button>
      </div>
    );
  }

  const totalDeductedWelfare = orders.reduce((sum, o) => sum + o.payment.welfareDeducted, 0);
  const totalDeductedMeal = orders.reduce((sum, o) => sum + o.payment.mealDeducted, 0);
  const totalWechatPaid = orders.reduce((sum, o) => sum + o.payment.wechatPaid, 0);
  const grandTotal = orders.reduce((sum, o) => sum + o.payment.finalPaidAmount, 0);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(`已复制核销码/单号：${text}`, 'success');
  };

  return (
    <div className="max-w-[1024px] mx-auto px-4 py-8 space-y-6 font-sans">
      {/* 1. 成功 Banner */}
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center space-y-3 shadow-xs">
        <div className="w-16 h-16 bg-green-100 text-[#18A058] rounded-full flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <h1 className="text-xl font-bold text-gray-900">福利采购订单提交成功！</h1>

        <p className="text-xs text-gray-500 max-w-md mx-auto">系统已自动扣减您的企业福利卡/餐卡余额，并根据商品所属供应商自动完成多仓库拆单排单发货。</p>

        {/* 核心金钱扣减卡片 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-xl mx-auto grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-500">合并单金额</div>
            <div className="text-base font-bold text-gray-900 mt-0.5">¥{grandTotal.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[var(--sw-brand)] font-bold">福利卡扣减</div>
            <div className="text-base font-bold text-[var(--sw-brand)] mt-0.5">¥{totalDeductedWelfare.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[#FF7A00] font-bold">餐卡/微信补差</div>
            <div className="text-base font-bold text-[#FF7A00] mt-0.5">¥{(totalDeductedMeal + totalWechatPaid).toFixed(2)}</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-4">
          <button onClick={() => navigateTo('orders')} className="bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-lg shadow-xs cursor-pointer transition-colors">
            查看我的订单
          </button>
          <button onClick={() => navigateTo('coupons')} className="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 font-bold text-xs px-6 py-2.5 rounded-lg cursor-pointer transition-colors">
            进入我的卡券包
          </button>
          <button onClick={() => navigateTo('home')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs px-6 py-2.5 rounded-lg cursor-pointer transition-colors">
            返回商城首页
          </button>
        </div>
      </div>

      {/* 2. 生成的拆单子订单与虚拟卡券核销码 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-xs space-y-4">
        <div className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between">
          <span>生成的供应商直发子订单清单 ({orders.length}个)</span>
          <span className="text-xs text-gray-400">主合并单号：{parentOrderNo}</span>
        </div>

        <div className="space-y-4">
          {orders.map((sub, idx) => (
            <div key={sub.id} className="border border-gray-200 rounded-lg p-4 text-xs space-y-3 bg-gray-50/50">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="bg-[var(--sw-brand)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">子订单 {idx + 1}</span>
                  <span className="font-bold text-gray-900">{sub.supplierName}</span>
                  <span className="text-gray-400 font-mono">({sub.orderNo})</span>
                </div>
                <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded">已接收 · 排单准备发货</span>
              </div>

              {/* 商品项 */}
              <div className="space-y-2">
                {sub.items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <img src={item.productImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      <div>
                        <div className="font-bold text-gray-800">{item.productTitle}</div>
                        <div className="text-[11px] text-gray-400">
                          {item.specText} × {item.quantity}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-gray-900">¥{(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 若包含虚拟券或门票核销码 */}
              {sub.verificationCode && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <div className="font-bold">电子核销码/卡密已生成：</div>
                      <div className="font-mono text-sm font-bold text-amber-700 tracking-wider">{sub.verificationCode}</div>
                    </div>
                  </div>

                  <button onClick={() => copyToClipboard(sub.verificationCode!)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer">
                    <Copy className="w-3.5 h-3.5" /> 复制核销码
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
