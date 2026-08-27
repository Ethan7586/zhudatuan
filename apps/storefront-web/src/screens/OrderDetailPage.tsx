/**
 * 智慧翼企业福利商城 - 订单详情页 OrderDetailPage screen
 * 包含履约时间轴、快递轨迹、拆单说明、精准扣费算式与增值税发票下载 preview
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { ArrowLeft, CheckCircle2, Clock, MapPin, Package, QrCode, ShieldCheck, Truck } from 'lucide-react';
import { useMall } from '../context/MallContext';

export const OrderDetailPage: React.FC = () => {
  const { routeParams, navigateTo, showToast, orders } = useMall();
  const orderId = routeParams.orderId;
  const order = orderId ? orders.find((candidate) => candidate.id === orderId) : undefined;

  if (!order) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-20 text-center">
        <Package className="mx-auto h-10 w-10 text-gray-400" />
        <h1 className="mt-4 text-lg font-bold text-gray-900">订单详情不可用</h1>
        <p className="mt-2 text-sm text-gray-500">数据库返回的当前订单列表中没有这条记录。</p>
        <button onClick={() => navigateTo('orders')} className="mt-5 rounded-lg bg-[var(--sw-brand)] px-5 py-2 text-sm font-bold text-white">
          返回订单列表
        </button>
      </div>
    );
  }

  const statusTextMap: Record<string, string> = {
    pending_payment: '待付款',
    pending_shipment: '待发货 / 仓库配货中',
    pending_receipt: '已发货 / 待收货',
    completed: '已归档完成',
    after_sale: '售后维权处理中',
  };

  const statusText = statusTextMap[order.status] || '已接单处理';
  const statusStepMap: Record<string, number> = {
    pending_payment: 1,
    pending_shipment: 2,
    pending_receipt: 3,
    completed: 4,
    after_sale: 3,
  };
  const statusSlaText: Record<string, string> = {
    pending_payment: '未支付订单通常 15 分钟内自动取消并释放库存',
    pending_shipment: '提交后通常 24 小时内进入备货发货',
    pending_receipt: '预计 24-72 小时内送达；超时可申请售后',
    completed: '签收/完成后可在 7 天内发起售后',
    after_sale: '售后工单通常 2-4 小时内有处理反馈',
  };
  const completedStep = statusStepMap[order.status] || 1;

  return (
    <div className="max-w-[1024px] mx-auto px-4 py-4 space-y-4 font-sans text-xs">
      {/* 1. 顶部返回面包屑 */}
      <div className="flex items-center justify-between text-xs">
        <button onClick={() => navigateTo('orders')} className="flex items-center gap-1 text-gray-600 hover:text-[var(--sw-brand)] font-bold cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> 返回我的订单列表
        </button>

        <span className="text-gray-400 font-mono">子订单号：{order.orderNo}</span>
      </div>

      {/* 2. 状态时间轴 (Timeline) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <div className="text-base font-bold text-gray-900">{statusText}</div>
            <div className="text-xs text-gray-400 mt-0.5">由【{order.supplierName}】承担采购与物流履约</div>
          </div>
          <span className="bg-blue-50 border border-blue-200 text-[var(--sw-brand)] font-bold text-xs px-3 py-1 rounded">集团福利协议保障订单</span>
        </div>

        {/* 步骤条 */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs pt-2">
          <div className="space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold ${completedStep >= 1 ? 'bg-[var(--sw-brand)] text-white' : 'bg-gray-200 text-gray-600'}`}>1</div>
            <div className="font-bold text-gray-800">已提交订单</div>
            <div className="text-[10px] text-gray-400">{order.createTime}</div>
          </div>

          <div className="space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold ${completedStep >= 2 ? 'bg-[var(--sw-brand)] text-white' : 'bg-gray-200 text-gray-600'}`}>2</div>
            <div className="font-bold text-gray-800">福利余额扣减与审核</div>
            <div className="text-[10px] text-gray-400">实时扣减完成</div>
          </div>

          <div className="space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold ${completedStep >= 3 ? 'bg-[var(--sw-brand)] text-white' : 'bg-gray-200 text-gray-600'}`}>3</div>
            <div className="font-bold text-gray-800">仓库出库与快递揽收</div>
            <div className="text-[10px] text-gray-400">{order.expressCompany ? `${order.expressCompany}` : '备货排单中'}</div>
          </div>

          <div className="space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold ${completedStep >= 4 ? 'bg-[var(--sw-brand)] text-white' : 'bg-gray-200 text-gray-600'}`}>4</div>
            <div className="font-bold text-gray-800">确认签收/归档</div>
            <div className="text-[10px] text-gray-400">{order.status === 'completed' ? '订单已完成' : '待签收'}</div>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 text-gray-400 text-[10px] flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          <span>{statusSlaText[order.status] || '平台处理中，预计 24 小时内更新'}</span>
        </div>
      </div>

      {/* 3. 物流实时轨迹与收货地址 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* 物流轨迹 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-green-600" /> 物流信息与配送跟踪
          </div>

          {order.trackingNo ? (
            <div className="space-y-2">
              <div className="text-gray-700">
                承运公司：<strong>{order.expressCompany}</strong>
              </div>
              <div className="text-gray-700">
                快递单号：<strong className="font-mono">{order.trackingNo}</strong>
              </div>

              {/* 模拟轨迹 */}
              <div className="border-l-2 border-blue-500 pl-3 space-y-2 pt-2 text-[11px]">
                <div className="text-blue-700 font-bold">【北京市】快递员正在派送中，请保持电话畅通。</div>
                <div className="text-gray-400">【北京市西城区转运中心】已收入仓，准备发往派送点。</div>
                <div className="text-gray-400">【平台直发仓】包裹已拣货打包完成，由顺丰速运揽收。</div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 py-4 text-center">订单正在仓库配货中，预计 24 小时内上传物流单号。</div>
          )}
        </div>

        {/* 收货地址与发票 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[var(--sw-brand)]" /> 收货地址与发票抬头
          </div>

          {order.address ? (
            <div className="space-y-1 text-gray-700">
              <div>
                收货人：<strong>{order.address.name}</strong> ({order.address.phone})
              </div>
              <div>
                地址：{order.address.province}
                {order.address.city}
                {order.address.district}
                {order.address.detail}
              </div>
            </div>
          ) : (
            <div className="text-gray-400">电子虚拟卡券/到店核销服务，无需实物配送地址。</div>
          )}

          <div className="border-t border-gray-100 pt-2 space-y-1">
            <div className="font-bold text-gray-900">电子发票信息：</div>
            <div className="text-gray-600">类型：{order.invoice?.type === 'company' ? '企业增值税发票' : '个人发票'}</div>
            <div className="text-gray-600">抬头：{order.invoice?.title || '个人'}</div>
            {order.invoice?.taxNumber && <div className="text-gray-600 font-mono">税号：{order.invoice.taxNumber}</div>}
          </div>
        </div>
      </div>

      {/* 4. 商品列表与精准扣款算式 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4 text-xs">
        <div className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">订购商品与金额结算算式</div>

        <div className="divide-y divide-gray-100">
          {order.items.map((item) => (
            <div key={item.productId} className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={item.productImage} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                <div>
                  <div className="font-bold text-gray-900">{item.productTitle}</div>
                  <div className="text-gray-400 text-[11px]">{item.specText}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-gray-900">
                  ¥{item.price.toFixed(2)} × {item.quantity}
                </div>
                <div className="text-[#FF7A00] font-bold">¥{(item.price * item.quantity).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 精准支付拆解 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1.5 text-right font-medium text-gray-700">
          <div>商品总金额：¥{order.payment.totalGoodsAmount.toFixed(2)}</div>
          <div>运费：¥{order.payment.shippingFee.toFixed(2)}</div>
          <div className="text-[var(--sw-brand)]">福利卡已抵扣：-¥{order.payment.welfareDeducted.toFixed(2)}</div>
          <div className="text-[#FF7A00]">餐卡已抵扣：-¥{order.payment.mealDeducted.toFixed(2)}</div>
          {order.payment.wechatPaid > 0 && <div className="text-red-600">微信补差已付：¥{order.payment.wechatPaid.toFixed(2)}</div>}
          <div className="text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
            最终合并扣除金额：
            <span className="text-[#FF7A00]">¥{order.payment.finalPaidAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={() => navigateTo('after-sale', { orderId: order.id })} className="border border-orange-300 text-orange-700 hover:bg-orange-50 font-bold px-4 py-2 rounded-lg cursor-pointer">
            申请售后/退款
          </button>
          <button onClick={() => showToast('电子发票PDF预检成功！正式版将在订单签收后同步至个人中心。', 'success')} className="bg-[var(--sw-brand)] text-white font-bold px-4 py-2 rounded-lg cursor-pointer">
            预览增值税发票
          </button>
        </div>
      </div>

      {/* 5. 风险与状态说明 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs text-xs space-y-2">
        <div className="font-bold text-gray-900 border-b border-gray-100 pb-1">售后与争议处理提示</div>
        <div className="text-gray-600 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
          <span>如超 7 天未响应或发票信息有误，可在订单详情页提交售后并携带订单号与支付流水。</span>
        </div>
        <div className="text-gray-600 flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-blue-600" />
          <span>核销码（如适用）：{order.verificationCode ? <span className="font-mono font-bold">{order.verificationCode}</span> : '本订单无需核销码'}</span>
          {order.verificationCode ? (
            <button onClick={() => navigateTo('after-sale', { orderId: order.id })} className="text-[var(--sw-brand)] underline text-[11px]">
              使用核销/售后协助
            </button>
          ) : null}
        </div>
        {order.verificationCode ? (
          <div className="text-[11px] text-amber-700">
            <QrCode className="w-3.5 h-3.5 inline mr-1" />
            电子券已绑定订单，确认收货前请留意券码过期与使用时效。
          </div>
        ) : null}
      </div>
    </div>
  );
};
