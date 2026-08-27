import React, { useState } from 'react';
import { useMall } from '../../context/MallContext';
import { ShoppingCart, Trash2, MapPin, CreditCard, Utensils, FileText, ShieldCheck, ChevronRight, CheckCircle2, Lock, ArrowRight, Building2, Wallet } from 'lucide-react';

export const TabletCartCheckoutPage: React.FC = () => {
  const { cart, user, setTabletPage, updateCartQuantity, toggleCartItemSelected, removeCartItem, triggerPendingFeature, checkoutSelectedCart, isSubmittingOrder } = useMall();

  const [useWelfareCard, setUseWelfareCard] = useState(true);
  const [useMealCard, setUseMealCard] = useState(true);

  const selectedItems = cart.filter((c) => c.selected);
  const subtotal = selectedItems.reduce((sum, item) => sum + item.product.priceMall * item.quantity, 0);

  // Deductions calculation logic
  let welfareDeduction = 0;
  let mealDeduction = 0;
  let remainingTotal = subtotal;

  if (useWelfareCard) {
    welfareDeduction = Math.min(user.welfareBalance, remainingTotal);
    remainingTotal -= welfareDeduction;
  }

  if (useMealCard && remainingTotal > 0) {
    mealDeduction = Math.min(user.mealBalance, remainingTotal);
    remainingTotal -= mealDeduction;
  }

  const handlePlaceOrder = async () => {
    if (await checkoutSelectedCart()) {
      setTabletPage('orders');
    }
  };

  return (
    <div className="bg-[#F5F7FA] h-full flex font-sans text-gray-800 overflow-hidden">
      {/* LEFT COLUMN: Grouped Cart Items & Address (~60%) */}
      <div className="w-[60%] p-4 overflow-y-auto space-y-4 border-r border-gray-200">
        {/* Address Banner */}
        <div
          onClick={() => triggerPendingFeature('平板地址管理器', '选择企采配送大楼与个人宿舍收货地址。')}
          className="bg-white rounded-3xl p-4 shadow-2xs border border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[var(--sw-brand)] flex items-center justify-center font-bold flex-shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900 flex items-center gap-2">
                <span>张伟 (员工工号 80219)</span>
                <span className="bg-blue-100 text-[var(--sw-brand)] text-[9px] font-black px-1.5 py-0.2 rounded">公司总部</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">北京市朝阳区中国建筑大厦 12F 企采仓发货口</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>

        {/* Grouped Cart Items List */}
        <div className="bg-white rounded-3xl p-4 shadow-2xs border border-gray-200 space-y-3">
          <div className="text-xs font-black text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--sw-brand-dark)]" />
              <span>企采自营福利仓商品 ({cart.length})</span>
            </span>
            <span className="text-[10px] text-gray-400">统仓发货 · 包邮</span>
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs space-y-2">
              <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto" />
              <div>购物车暂无商品</div>
              <button onClick={() => setTabletPage('home')} className="bg-[var(--sw-brand)] text-white font-bold text-xs px-4 py-2 rounded-xl mt-2 cursor-pointer">
                去挑选福利
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {cart.map((item) => (
                <div key={item.id} className="py-3 flex items-center gap-3 text-xs">
                  {/* Select Checkbox */}
                  <input type="checkbox" checked={item.selected} onChange={() => toggleCartItemSelected(item.id)} className="w-4 h-4 rounded text-[var(--sw-brand)] border-gray-300 cursor-pointer" />

                  <img src={item.product.images[0]} alt={item.product.title} className="w-16 h-16 object-cover rounded-2xl border border-gray-100 flex-shrink-0" />

                  <div className="flex-1 overflow-hidden space-y-1">
                    <div className="font-bold text-gray-900 truncate">{item.product.title}</div>
                    <div className="text-[10px] text-gray-400">{item.product.itemType === 'virtual_coupon' ? '虚拟兑换券' : '实物包邮'}</div>
                    <div className="font-mono font-bold text-[#E5484D] text-xs">¥{item.product.priceMall}</div>
                  </div>

                  {/* Quantity Modifier */}
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                    <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="px-2.5 py-1 bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 min-h-[36px]">
                      -
                    </button>
                    <span className="px-3 py-1 font-mono font-bold text-xs">{item.quantity}</span>
                    <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="px-2.5 py-1 bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 min-h-[36px]">
                      +
                    </button>
                  </div>

                  {/* Trash */}
                  <button onClick={() => removeCartItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 cursor-pointer min-h-[36px]">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Split View Checkout Summary Panel (~40%) */}
      <div className="w-[40%] p-5 bg-white border-l border-gray-200 overflow-y-auto flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <div className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
            <span>企采计算与抵扣汇总</span>
            <span className="text-[10px] bg-blue-50 text-[var(--sw-brand)] font-bold px-2 py-0.5 rounded">Split View</span>
          </div>

          {/* Pricing Breakdown Card */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 text-xs text-gray-700 border border-gray-200">
            <div className="flex justify-between">
              <span className="text-gray-500">已选商品金额 ({selectedItems.length} 件):</span>
              <span className="font-mono font-bold text-gray-900">¥{subtotal.toFixed(2)}</span>
            </div>

            {/* Welfare Card Switch */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-2">
              <div className="flex items-center gap-1.5 font-bold">
                <CreditCard className="w-4 h-4 text-yellow-600" />
                <span>福利卡余额抵扣</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-600">-¥{welfareDeduction.toFixed(2)}</span>
                <input type="checkbox" checked={useWelfareCard} onChange={(e) => setUseWelfareCard(e.target.checked)} className="w-4 h-4 rounded text-[var(--sw-brand)] cursor-pointer" />
              </div>
            </div>

            {/* Meal Card Switch */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-2">
              <div className="flex items-center gap-1.5 font-bold">
                <Utensils className="w-4 h-4 text-amber-600" />
                <span>餐卡余额冲抵</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-600">-¥{mealDeduction.toFixed(2)}</span>
                <input type="checkbox" checked={useMealCard} onChange={(e) => setUseMealCard(e.target.checked)} className="w-4 h-4 rounded text-[var(--sw-brand)] cursor-pointer" />
              </div>
            </div>

            {/* External Payment Gap */}
            {remainingTotal > 0 && (
              <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-[#E5484D]">
                <span className="flex items-center gap-1">
                  <Wallet className="w-4 h-4" />
                  <span>外部补差额度:</span>
                </span>
                <span className="font-mono">¥{remainingTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Invoice Header Selector */}
          <div className="bg-white rounded-2xl p-3.5 shadow-2xs border border-gray-200 space-y-1.5 text-xs">
            <div className="text-gray-500 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-gray-500" />
                <span>开票抬头</span>
              </span>
              <span className="text-[10px] text-blue-600 font-bold">专票包邮</span>
            </div>
            <div className="font-bold text-gray-900 text-xs">中国建筑集团有限公司 (增值税专用发票)</div>
          </div>
        </div>

        {/* Submit Order Action Button */}
        <div className="space-y-3 border-t border-gray-200 pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold text-gray-600">实际需补差额</span>
            <span className="text-2xl font-black font-mono text-[#E5484D]">¥{remainingTotal.toFixed(2)}</span>
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={selectedItems.length === 0 || isSubmittingOrder}
            className={`w-full font-black text-xs py-3.5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[48px] ${
              selectedItems.length > 0 ? 'bg-gradient-to-r from-[var(--sw-brand)] to-[var(--sw-brand-dark)] hover:opacity-95 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span>{isSubmittingOrder ? '安全提交中…' : `提交真实订单（福利冲抵 ¥${(welfareDeduction + mealDeduction).toFixed(2)}）`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
