import React, { useState } from 'react';
import { useMall, LaptopPage } from '../../context/MallContext';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Gift, ShieldCheck, CheckCircle2, Building, MapPin, FileText, Zap, ArrowRight } from 'lucide-react';
import { STOREFRONT_WEB_SURFACE_COPY, type StorefrontWebSurface } from './StorefrontWebStandard';

interface LaptopCartCheckoutPageProps {
  onSelectTab: (tab: LaptopPage) => void;
  surface?: StorefrontWebSurface;
}

export const LaptopCartCheckoutPage: React.FC<LaptopCartCheckoutPageProps> = ({ onSelectTab, surface = 'laptop' }) => {
  const { cart, updateCartQuantity, removeCartItem, user, addresses, showToast, navigateTo, checkoutSelectedCart, isSubmittingOrder } = useMall();
  const surfaceCopy = STOREFRONT_WEB_SURFACE_COPY[surface];

  const [useWelfareDeduction, setUseWelfareDeduction] = useState<boolean>(true);
  const [useMealDeduction, setUseMealDeduction] = useState<boolean>(true);
  const [invoiceHeader, setInvoiceHeader] = useState<string>(user.enterpriseName);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.product.priceWelfare * item.quantity, 0);

  // Maximum allowed deductions
  const maxWelfareDeduction = useWelfareDeduction ? Math.min(subtotal, user.welfareBalance) : 0;
  const remainingAfterWelfare = Math.max(0, subtotal - maxWelfareDeduction);

  // Meal deduction applied to eligible items or remaining
  const maxMealDeduction = useMealDeduction ? Math.min(remainingAfterWelfare, user.mealBalance) : 0;

  const totalDeduction = maxWelfareDeduction + maxMealDeduction;
  const gapPayment = Math.max(0, subtotal - totalDeduction);

  const handleCheckout = async () => {
    if (await checkoutSelectedCart()) {
      onSelectTab('orders');
    }
  };

  return (
    <div className="w-full bg-[#F5F7FA] min-h-[80vh] pb-10 font-sans">
      <div className="sw-web-container max-w-[1240px] mx-auto pt-3 px-3 space-y-3">
        {/* 页头标题 */}
        <div className="flex items-center justify-between text-xs border-b border-gray-200 pb-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[var(--sw-brand)]" />
            <h1 className="font-extrabold text-sm text-gray-900">购物车与企业福利联合结算</h1>
          </div>
          <span className="text-gray-400">{surfaceCopy.cartLayoutLabel}</span>
        </div>

        {/* 购物车为空处理 */}
        {cart.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center space-y-3">
            <div className="text-gray-400">您的企采购物车内暂无商品</div>
            <button onClick={() => onSelectTab('category')} className="bg-[var(--sw-brand)] text-white text-xs font-bold px-4 py-2 rounded-md hover:bg-blue-700 cursor-pointer">
              选购企业福利商品
            </button>
          </div>
        ) : (
          /* 主体两栏：左侧商品表格与订单配置 (~65%) | 右侧固定结算卡片 (~35%) */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            {/* 左侧区域 (8列) */}
            <div className="md:col-span-8 space-y-3">
              {/* 商品列表（按仓库分组紧凑展示） */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden">
                <div className="bg-gray-100 text-gray-700 px-3 py-2 text-xs font-bold flex items-center justify-between border-b border-gray-200">
                  <span>企采供货仓：京东供应链 / 自营仓</span>
                  <span className="text-[10px] text-gray-500">已选 {cart.length} 件商品</span>
                </div>

                <div className="divide-y divide-gray-100 text-xs">
                  {cart.map((item) => (
                    <div key={item.product.id} className="p-3 flex items-center gap-3">
                      {/* 商品图片 */}
                      <div className="w-14 h-14 bg-gray-50 border border-gray-200 rounded p-1 flex-shrink-0 flex items-center justify-center">
                        <img src={item.product.images[0]} alt={item.product.title} className="max-h-full max-w-full object-contain" />
                      </div>

                      {/* 标题与福利标签 */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 truncate text-xs">{item.product.title}</h3>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                          <span className="bg-blue-50 text-[var(--sw-brand)] font-medium px-1 rounded">福利卡可用</span>
                          {item.product.allowedAccounts.includes('meal') && <span className="bg-emerald-50 text-emerald-700 font-medium px-1 rounded">餐卡可用</span>}
                        </div>
                      </div>

                      {/* 单价 */}
                      <div className="text-right min-w-[70px]">
                        <div className="font-black text-[#E5484D] text-xs">¥{item.product.priceWelfare.toFixed(2)}</div>
                        <div className="text-[10px] text-gray-400 line-through">¥{item.product.priceMarket.toFixed(2)}</div>
                      </div>

                      {/* 数量调节器 */}
                      <div className="flex items-center border border-gray-300 rounded">
                        <button onClick={() => updateCartQuantity(item.product.id, Math.max(1, item.quantity - 1))} className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 cursor-pointer">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-bold text-gray-800 text-xs">{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)} className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 cursor-pointer">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* 删除 */}
                      <button onClick={() => removeCartItem(item.product.id)} className="text-gray-400 hover:text-red-600 p-1 cursor-pointer transition-colors" title="移除商品">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 配送与发票抬头设置 */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-2xs space-y-2.5 text-xs">
                <div className="font-bold text-gray-800 border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[var(--sw-brand)]" />
                  <span>配送地址与开票抬头</span>
                </div>

                <div className="space-y-1.5">
                  <div className="p-2 bg-blue-50/60 border border-blue-200 rounded flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-800">{addresses[0] ? `${addresses[0].name} ${addresses[0].phone}` : '暂无收货人'}</div>
                      <div className="text-[11px] text-gray-600">{addresses[0] ? `${addresses[0].province}${addresses[0].city}${addresses[0].district}${addresses[0].detail}` : '请先新增收货地址'}</div>
                    </div>
                    <span className="text-[10px] bg-[var(--sw-brand)] text-white px-1.5 py-0.5 rounded font-bold">默认办公地址</span>
                  </div>

                  <div className="p-2 bg-gray-50 border border-gray-200 rounded flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="font-bold text-gray-700">开票抬头：</span>
                      <span className="text-[11px] text-gray-600">{invoiceHeader}</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">增值税专用发票</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：固定卡片与结算扣减算术明细 (4列) */}
            <div className="sw-web-checkout-summary md:col-span-4 bg-white border border-gray-200 rounded-lg p-3.5 shadow-xs space-y-3 sticky top-[100px]">
              <div className="font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-2">结算汇总与福利卡扣减</div>

              {/* 抵扣勾选项 */}
              <div className="space-y-2 text-xs">
                <label className="p-2 bg-blue-50/80 rounded border border-blue-200 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" checked={useWelfareDeduction} onChange={(e) => setUseWelfareDeduction(e.target.checked)} className="rounded text-[var(--sw-brand)]" />
                    <CreditCard className="w-3.5 h-3.5 text-[var(--sw-brand)]" />
                    <span className="font-bold text-gray-800">福利卡抵扣</span>
                  </div>
                  <span className="font-bold text-[var(--sw-brand-dark)]">-¥{maxWelfareDeduction.toFixed(2)}</span>
                </label>

                <label className="p-2 bg-emerald-50/80 rounded border border-emerald-200 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" checked={useMealDeduction} onChange={(e) => setUseMealDeduction(e.target.checked)} className="rounded text-emerald-600" />
                    <Gift className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-bold text-gray-800">餐卡抵扣</span>
                  </div>
                  <span className="font-bold text-emerald-700">-¥{maxMealDeduction.toFixed(2)}</span>
                </label>
              </div>

              {/* 金额拆解明细 */}
              <div className="space-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-2.5">
                <div className="flex justify-between">
                  <span>商品金额小计:</span>
                  <span className="font-bold text-gray-800">¥{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[var(--sw-brand)]">
                  <span>福利卡抵扣:</span>
                  <span>-¥{maxWelfareDeduction.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>餐卡抵扣:</span>
                  <span>-¥{maxMealDeduction.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100 text-sm">
                  <span>需补差额支付:</span>
                  <span className="text-[#E5484D] font-black text-base">¥{gapPayment.toFixed(2)}</span>
                </div>
              </div>

              {/* 提交按钮 (必须不可被遮挡) */}
              <button
                onClick={handleCheckout}
                disabled={isSubmittingOrder}
                className="w-full bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-extrabold py-3 rounded-lg text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4 text-yellow-300" />
                {isSubmittingOrder ? '安全提交中…' : '确认并提交真实订单'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-[10px] text-gray-400 text-center flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>支付流程符合国企合规采购与财务报销规范</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
