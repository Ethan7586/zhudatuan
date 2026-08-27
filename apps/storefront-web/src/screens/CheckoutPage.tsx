/**
 * 智慧翼企业福利商城 - 确认订单页 CheckoutPage screen
 * 处理配送地址、发票抬头发起、福利卡/餐卡精准扣费、微信补差模拟与订单提交拆单
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { CreditCard, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { CheckoutAddressModal } from '../features/checkout/CheckoutAddressModal';
import { CheckoutAddressSelector } from '../features/checkout/CheckoutAddressSelector';
import { useCheckoutModel } from '../features/checkout/useCheckoutModel';

export const CheckoutPage: React.FC = () => {
  const model = useCheckoutModel();
  const {
    user,
    addresses,
    navigateTo,
    isSubmitting,
    selectedItems,
    invalidItems,
    selectedAddrId,
    setSelectedAddrId,
    setShowAddAddrModal,
    totalGoodsAmount,
    useWelfare,
    setUseWelfare,
    welfareInput,
    setWelfareInput,
    remAfterWelfare,
    useMeal,
    setUseMeal,
    mealInput,
    setMealInput,
    paymentAllocation,
    finalWechatTopUp,
    invoiceType,
    setInvoiceType,
    invoiceTitle,
    setInvoiceTitle,
    invoiceTaxNo,
    setInvoiceTaxNo,
    userRemark,
    setUserRemark,
    submitBlocker,
    groupedItems,
    handleSubmitOrder,
  } = model;

  if (selectedItems.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-12 text-center font-sans space-y-3">
        <h2 className="text-base font-bold text-gray-800">暂无已勾选的待结算商品</h2>
        <button onClick={() => navigateTo('cart')} className="bg-[var(--sw-brand)] text-white text-xs font-bold px-4 py-2 rounded">
          返回购物车勾选商品
        </button>
      </div>
    );
  }

  const steps = [
    { id: 1, label: '选择商品与地址', done: true },
    { id: 2, label: '确认明细', done: selectedItems.length > 0 },
    { id: 3, label: '支付并提交', done: selectedItems.length > 0 && !isSubmitting && !submitBlocker },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-6 font-sans">
      <div className="font-bold text-lg text-gray-900 border-b border-gray-200 pb-3 flex items-center justify-between">
        <span>确认福利采购订单</span>
        <span className="text-xs font-normal text-gray-500">包含 {groupedItems.length} 个供应商直发子订单</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-md p-2">
        {steps.map((step) => (
          <div key={step.id} className={`rounded border px-2 py-1.5 text-center ${step.done ? 'bg-blue-50 border-blue-100 text-[var(--sw-brand)] font-bold' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
            {step.id} {step.label}
          </div>
        ))}
      </div>

      <CheckoutAddressSelector model={model} />

      {/* 2. 商品按供应商拆单清单预览 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
        <div className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">订购商品与拆单明细</div>

        {groupedItems.map(([supplierName, items]) => (
          <div key={supplierName} className="border border-gray-200 rounded p-4 space-y-3 bg-gray-50/40">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800 border-b border-gray-100 pb-2">
              <span className="bg-[var(--sw-brand)] text-white text-[10px] px-1.5 py-0.5 rounded">子订单</span>
              <span>{supplierName} 直发仓</span>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <img src={item.product.images[0]} alt="" className="w-12 h-12 rounded object-cover border border-gray-200" />
                    <div>
                      <div className="font-bold text-gray-900">{item.product.title}</div>
                      <div className="text-gray-400 text-[11px]">
                        规格：
                        {Object.entries(item.selectedSpec)
                          .map(([k, v]) => `${k}:${v}`)
                          .join(' ')}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-gray-900">
                      ¥{item.product.priceWelfare.toFixed(2)} × {item.quantity}
                    </div>
                    <div className="text-[#FF7A00] font-bold">¥{(item.product.priceWelfare * item.quantity).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 3. 福利卡/餐卡与微信补差精准算式 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
        <div className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[var(--sw-brand)]" />
          <span>选择福利账户扣减与补差方式</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* 福利卡扣减 */}
          <div className="bg-[var(--sw-brand-light)] border border-blue-200 rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-blue-900">
                <input type="checkbox" checked={useWelfare} onChange={(e) => setUseWelfare(e.target.checked)} className="w-4 h-4 text-[var(--sw-brand)] rounded" />
                <span>使用福利卡余额抵扣</span>
              </label>
              <span className="text-blue-700 font-bold">个人可用余额: ¥{user.welfareBalance.toFixed(2)}</span>
            </div>

            {useWelfare && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-gray-600 font-medium">抵扣金额：¥</span>
                <input
                  type="number"
                  value={welfareInput}
                  onChange={(e) => setWelfareInput(Math.min(totalGoodsAmount, user.welfareBalance, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-32 bg-white border border-blue-300 rounded px-2 py-1 text-xs font-bold text-[var(--sw-brand)]"
                />
                <button onClick={() => setWelfareInput(Math.min(totalGoodsAmount, user.welfareBalance))} className="text-[11px] text-[var(--sw-brand)] underline font-bold">
                  最大化使用
                </button>
              </div>
            )}
          </div>

          {/* 餐卡扣减 */}
          <div className="bg-orange-50 border border-orange-200 rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-orange-900">
                <input type="checkbox" checked={useMeal} onChange={(e) => setUseMeal(e.target.checked)} className="w-4 h-4 text-[#FF7A00] rounded" />
                <span>使用餐卡专享余额抵扣</span>
              </label>
              <span className="text-orange-700 font-bold">餐卡可用余额: ¥{user.mealBalance.toFixed(2)}</span>
            </div>

            {useMeal && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-gray-600 font-medium">抵扣金额：¥</span>
                <input
                  type="number"
                  value={mealInput}
                  onChange={(e) => setMealInput(Math.min(remAfterWelfare, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-32 bg-white border border-orange-300 rounded px-2 py-1 text-xs font-bold text-[#FF7A00]"
                />
                <button onClick={() => setMealInput(Math.min(remAfterWelfare, user.mealBalance))} className="text-[11px] text-[#FF7A00] underline font-bold">
                  最大化使用
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 微信补差试算 */}
        {finalWechatTopUp > 0 ? (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded p-3 text-xs flex items-center justify-between">
            <span className="font-bold">福利卡与餐卡扣减后仍有差额，需要使用微信支付在线补差：</span>
            <span className="text-base font-black text-red-600">需补差金额：¥{finalWechatTopUp.toFixed(2)}</span>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 text-green-900 rounded p-3 text-xs flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>福利卡/餐卡余额充足，本次采购享受 100% 账户余额全额抵扣，无需额外掏钱！</span>
          </div>
        )}
      </div>

      {/* 4. 发票与备注 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        <div className="space-y-3">
          <div className="font-bold text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
            <FileText className="w-4 h-4 text-[var(--sw-brand)]" /> 发票开具选项
          </div>

          <div className="flex items-center gap-3">
            {[
              { id: 'company', label: '企业增值税发票' },
              { id: 'personal', label: '个人抬头' },
              { id: 'none', label: '暂不开票' },
            ].map((inv) => (
              <label key={inv.id} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="invType" checked={invoiceType === inv.id} onChange={() => setInvoiceType(inv.id as any)} className="text-[var(--sw-brand)]" />
                <span>{inv.label}</span>
              </label>
            ))}
          </div>

          {invoiceType === 'company' && (
            <div className="space-y-2 pt-1">
              <input type="text" placeholder="企业发票抬头" value={invoiceTitle} onChange={(e) => setInvoiceTitle(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-1.5 bg-gray-50 text-xs font-semibold" />
              <input type="text" placeholder="纳税人识别号" value={invoiceTaxNo} onChange={(e) => setInvoiceTaxNo(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-1.5 bg-gray-50 text-xs font-mono" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="font-bold text-gray-900 border-b border-gray-100 pb-2">买家留言 / 订单特别说明</div>
          <textarea
            rows={3}
            value={userRemark}
            onChange={(e) => setUserRemark(e.target.value)}
            placeholder="填写对发货物流、卡券兑换或公司行政核销的特殊要求..."
            className="w-full border border-gray-300 rounded p-2 text-xs bg-gray-50 focus:outline-none"
          />
        </div>
      </div>

      {/* 5. 结算按钮与费用汇总 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="text-gray-500 space-y-1">
          {submitBlocker ? <div className="text-red-600 font-bold">{submitBlocker}</div> : null}
          <div>提交后将自动在后台扣减福利卡与餐卡，并生成子订单</div>
          <div className="text-blue-600 font-medium">技术服务保障方：雍彻科技 企业集采安全校验机制已开启</div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right space-y-1">
            <div className="text-gray-600 font-bold">
              应付金额：
              <strong className="text-2xl font-black text-[#FF7A00]">¥{totalGoodsAmount.toFixed(2)}</strong>
            </div>
            <div className="text-[11px] text-gray-500">
              福利卡扣: ¥{(useWelfare ? welfareInput : 0).toFixed(2)} | 餐卡扣: ¥{(useMeal ? mealInput : 0).toFixed(2)} | 微信补: ¥{finalWechatTopUp.toFixed(2)}
            </div>
          </div>

          <button
            onClick={() => void handleSubmitOrder()}
            disabled={isSubmitting || Boolean(submitBlocker)}
            className="bg-[var(--sw-brand)] disabled:bg-blue-300 hover:bg-blue-700 text-white font-black px-8 py-3 rounded text-sm shadow-md transition-colors cursor-pointer flex items-center gap-2"
          >
            <span>{isSubmitting ? '正在安全提交…' : submitBlocker ? submitBlocker : '立即提交订单'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <CheckoutAddressModal model={model} />
    </div>
  );
};
