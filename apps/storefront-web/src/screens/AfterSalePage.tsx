/**
 * 智慧翼企业福利商城 - 售后服务与退款申请页 AfterSalePage screen
 * 包含退款不退货/退货退款/换货类型选择、福利卡余额原路退回规则与记录追踪
 * 技术服务方：雍彻科技
 */

import React, { useState } from 'react';
import { useMall } from '../context/MallContext';
import { productionApi, ProductionApiError } from '../services/productionApi';
import { ShieldAlert, ArrowLeft, CheckCircle2, AlertCircle, FileText, Upload, RefreshCw } from 'lucide-react';

export const AfterSalePage: React.FC = () => {
  const { routeParams, navigateTo, showToast, refreshProductionData, orders, sessionStatus } = useMall();

  const orderId = routeParams.orderId;
  const order = orders.find((item) => item.id === orderId) ?? orders[0];

  const [afterSaleType, setAfterSaleType] = useState<'refund_only' | 'return_goods' | 'exchange'>('return_goods');
  const [reason, setReason] = useState('商品质量问题');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [afterSaleNo, setAfterSaleNo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitAfterSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) {
      showToast('未找到可申请售后的订单', 'error');
      return;
    }
    if (sessionStatus !== 'authenticated') {
      showToast('请先登录账户，再提交售后申请', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const result = await productionApi.createAfterSale({
        orderId: order.id,
        type: afterSaleType === 'return_goods' ? 'return_refund' : afterSaleType,
        reason: `${reason}：${description.trim()}`,
        requestedAmountCents: Math.round(order.payment.finalPaidAmount * 100),
      });
      setAfterSaleNo(result.afterSale.afterSaleNo);
      await refreshProductionData();
      setSubmitted(true);
      showToast('售后申请已写入生产数据库，当前状态为待审核', 'success');
    } catch (error) {
      showToast(error instanceof ProductionApiError ? error.message : '售后服务暂时不可用', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) {
    return (
      <div className="max-w-[1024px] mx-auto px-4 py-12 text-center space-y-3">
        <h2 className="text-base font-bold text-gray-800">当前商城暂无可申请售后的订单</h2>
        <button onClick={() => navigateTo('orders')} className="bg-[var(--sw-brand)] text-white px-4 py-2 rounded text-xs font-bold">
          返回订单列表
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1024px] mx-auto px-4 py-4 space-y-4 font-sans text-xs">
      {/* 面包屑 */}
      <button onClick={() => navigateTo('orders')} className="flex items-center gap-1 text-gray-600 hover:text-[var(--sw-brand)] font-bold">
        <ArrowLeft className="w-4 h-4" /> 返回我的订单列表
      </button>

      {submitted ? (
        <div className="bg-white border border-gray-200 rounded-md p-8 text-center space-y-3 shadow-xs">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
          <h2 className="text-base font-bold text-gray-900">售后申请已成功录入</h2>
          <p className="text-gray-500">
            服务工单：<strong className="font-mono text-gray-900">{afterSaleNo}</strong> · 状态：待审核
          </p>
          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-blue-900 max-w-md mx-auto text-[11px]">
            退款须知：经合规确认后，抵扣的福利卡金额 (¥{order.payment.welfareDeducted.toFixed(2)}) 与餐卡金额 (¥
            {order.payment.mealDeducted.toFixed(2)}) 将在 1 个工作日内实时退回您的企业福利账户。
          </div>
          <button onClick={() => navigateTo('orders')} className="bg-[var(--sw-brand)] text-white font-bold px-6 py-2 rounded">
            返回我的订单
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md p-6 shadow-xs space-y-6">
          <div className="font-bold text-base text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between">
            <span>申请商品售后与退款</span>
            <span className="text-xs text-gray-400">订单号：{order.orderNo}</span>
          </div>

          {/* 关联商品概览 */}
          <div className="bg-gray-50 p-4 rounded border border-gray-200 space-y-2">
            <div className="font-bold text-gray-700 mb-2">服务对象商品：</div>
            {order.items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={item.productImage} alt="" className="w-10 h-10 rounded object-cover" />
                  <div>
                    <div className="font-bold text-gray-900">{item.productTitle}</div>
                    <div className="text-gray-400 text-[11px]">{item.specText}</div>
                  </div>
                </div>
                <div className="font-bold text-gray-900">
                  ¥{item.price.toFixed(2)} × {item.quantity}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmitAfterSale} className="space-y-5">
            {/* 服务类型 */}
            <div>
              <label className="block font-bold text-gray-800 mb-2">选择售后类型：</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    id: 'return_goods',
                    title: '退货退款',
                    desc: '收到货需退回商品并归还福利扣减金额',
                  },
                  {
                    id: 'refund_only',
                    title: '仅退款 (无需退货)',
                    desc: '未收到货或协商一致直接退款',
                  },
                  { id: 'exchange', title: '换货', desc: '商品质量问题申请更换同规格新品' },
                ].map((type) => (
                  <div
                    key={type.id}
                    onClick={() => setAfterSaleType(type.id as any)}
                    className={`p-3 rounded border cursor-pointer transition-all ${afterSaleType === type.id ? 'border-[var(--sw-brand)] bg-blue-50/60 font-bold text-[var(--sw-brand)]' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                  >
                    <div className="font-bold">{type.title}</div>
                    <div className="text-[10px] text-gray-400 font-normal mt-0.5">{type.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 原因选择 */}
            <div>
              <label className="block font-bold text-gray-800 mb-1">申请原因：</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-gray-300 rounded p-2 bg-gray-50 text-xs">
                <option value="商品质量问题">商品质量问题 / 破损</option>
                <option value="发错商品/配件不全">发错商品 / 规格与描述不符</option>
                <option value="7天无理由退货">7天无理由退货 (保障期内)</option>
                <option value="物流配送超时">物流配送超时未收到</option>
              </select>
            </div>

            {/* 详细说明 */}
            <div>
              <label className="block font-bold text-gray-800 mb-1">详细原因描述：</label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请详细说明遇到的问题，便于专员快速审核..."
                className="w-full border border-gray-300 rounded p-2 bg-gray-50 text-xs"
              />
            </div>

            {/* 凭证上传模拟 */}
            <div>
              <label className="block font-bold text-gray-800 mb-1">图片凭证 (选填)：</label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center text-gray-400 space-y-1 hover:border-[var(--sw-brand)] transition-colors cursor-pointer">
                <Upload className="w-6 h-6 mx-auto text-gray-400" />
                <div>点击或拖拽上传现场图片/快递包装凭证 (最多5张)</div>
              </div>
            </div>

            {/* 提交按钮 */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => navigateTo('orders')} className="px-5 py-2 border rounded font-bold text-gray-600">
                取消
              </button>
              <button type="submit" disabled={submitting} className="px-6 py-2 bg-[var(--sw-brand)] text-white font-black rounded shadow-xs">
                {submitting ? '正在安全提交…' : '确认提交售后工单'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
