import React from 'react';
import { useMall } from '../../context/MallContext';
import { WeChatCapsule } from '../../components/mobile/WeChatCapsule';
import { WeChatTabBar } from '../../components/mobile/WeChatTabBar';
import { Trash2, ShoppingBag, CreditCard, ShieldCheck, ChevronRight, CheckSquare, Square } from 'lucide-react';

export const MPCartPage: React.FC = () => {
  const { cart, user, updateCartQuantity, toggleCartItemSelected, toggleSelectAllCart, removeCartItem, setMpPage, triggerPendingFeature, checkoutSelectedCart, isSubmittingOrder } = useMall();

  const selectedItems = cart.filter((i) => i.selected);
  const isAllSelected = cart.length > 0 && cart.every((i) => i.selected);

  const totalPrice = selectedItems.reduce((sum, i) => sum + i.product.priceMall * i.quantity, 0);
  const totalSubsidy = selectedItems.reduce((sum, i) => sum + Math.max(0, i.product.priceMarket - i.product.priceWelfare) * i.quantity, 0);

  const handleCheckout = async () => {
    if (selectedItems.length === 0) return;
    if (await checkoutSelectedCart()) {
      setMpPage('profile');
    }
  };

  return (
    <div className="bg-[#F5F7FA] min-h-full flex flex-col font-sans text-gray-800 pb-16">
      <WeChatCapsule title="福利购物车" />

      {/* 顶部福利卡余额提示栏 */}
      <div className="bg-[var(--sw-brand-light)] border-b border-blue-200/80 px-3 py-2 flex items-center justify-between text-xs text-blue-900">
        <div className="flex items-center gap-1.5 font-medium">
          <CreditCard className="w-4 h-4 text-[var(--sw-brand)]" />
          <span>福利卡可用余额：</span>
          <span className="font-black text-[var(--sw-brand)] font-mono">¥{user.welfareBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
        </div>
        <span className="text-[10px] bg-white text-[var(--sw-brand)] font-bold px-2 py-0.5 rounded border border-blue-200">全额抵扣无须自费</span>
      </div>

      {/* 购物车为空 */}
      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-[var(--sw-brand)] flex items-center justify-center shadow-xs">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">购物车暂无商品</h3>
            <p className="text-xs text-gray-400 mt-0.5">快去选购员工专属协议特惠福利吧</p>
          </div>
          <button onClick={() => setMpPage('home')} className="bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md cursor-pointer">
            去商城逛逛
          </button>
        </div>
      ) : (
        <div className="p-3 space-y-3 flex-1 overflow-y-auto">
          {/* Supplier Group Header */}
          <div className="bg-white rounded-2xl p-3 shadow-xs border border-gray-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 text-xs">
              <button onClick={() => toggleSelectAllCart(!isAllSelected)} className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                {isAllSelected ? <CheckSquare className="w-4 h-4 text-[var(--sw-brand)]" /> : <Square className="w-4 h-4 text-gray-300" />}
                <span>中国建筑集团企采直供仓</span>
              </button>

              <span className="text-[10px] text-gray-400">自营统一发货</span>
            </div>

            {/* Cart Items List */}
            <div className="space-y-3 divide-y divide-gray-100">
              {cart.map((item) => (
                <div key={item.id} className="pt-3 first:pt-0 flex items-center gap-2.5">
                  <button onClick={() => toggleCartItemSelected(item.id)} className="p-1 cursor-pointer">
                    {item.selected ? <CheckSquare className="w-4 h-4 text-[var(--sw-brand)]" /> : <Square className="w-4 h-4 text-gray-300" />}
                  </button>

                  <img src={item.product.images[0]} alt={item.product.title} className="w-16 h-16 object-cover rounded-xl border border-gray-100 flex-shrink-0" />

                  <div className="flex-1 overflow-hidden space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{item.product.title}</h4>
                      <button onClick={() => removeCartItem(item.id)} className="text-gray-400 hover:text-red-500 p-0.5 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded w-fit">{Object.values(item.selectedSpec || {}).join(' / ') || '默认企采规格'}</div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-xs font-black text-[#E5484D] font-mono">¥{item.product.priceMall}</span>
                        <span className="text-[9px] text-gray-400 line-through ml-1">¥{item.product.priceMarket}</span>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
                        <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="px-2 py-0.5 bg-gray-50 font-bold hover:bg-gray-100">
                          -
                        </button>
                        <span className="px-2.5 py-0.5 font-bold font-mono">{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="px-2 py-0.5 bg-gray-50 font-bold hover:bg-gray-100">
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coupon & Invoice Banner */}
          <div className="bg-white rounded-2xl p-3 shadow-xs border border-gray-100 space-y-2 text-xs">
            <div onClick={() => triggerPendingFeature('微信小程序 企采优惠券与包邮卡', '选择或核销企业专项优惠券。')} className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-600 font-medium">企业企采优惠券</span>
              <span className="text-[var(--sw-brand)] font-bold flex items-center gap-0.5">
                <span>已选最佳优惠 (-¥{totalSubsidy > 0 ? totalSubsidy.toFixed(2) : '0.00'})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-gray-600 font-medium">
              <span>开具发票抬头</span>
              <span className="text-gray-800 font-bold">中国建筑集团有限公司 (电子普通发票)</span>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Settlement Footer Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-12 left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-gray-200/90 p-3 z-40 flex items-center justify-between shadow-2xl">
          <button onClick={() => toggleSelectAllCart(!isAllSelected)} className="flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
            {isAllSelected ? <CheckSquare className="w-4 h-4 text-[var(--sw-brand)]" /> : <Square className="w-4 h-4 text-gray-300" />}
            <span>全选</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-gray-500">
                已选 <span className="text-[var(--sw-brand)] font-bold">{selectedItems.length}</span> 件商品
              </div>
              <div className="text-xs font-bold text-gray-900">
                合计: <span className="text-sm font-black text-[#E5484D] font-mono">¥{totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={selectedItems.length === 0 || isSubmittingOrder}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all cursor-pointer ${
                selectedItems.length > 0 ? 'bg-gradient-to-r from-[var(--sw-brand)] to-[var(--sw-brand-dark)] hover:bg-blue-700 shadow-blue-500/20' : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isSubmittingOrder ? '安全提交中…' : '去结算（真实账户扣减）'}
            </button>
          </div>
        </div>
      )}

      <WeChatTabBar />
    </div>
  );
};
