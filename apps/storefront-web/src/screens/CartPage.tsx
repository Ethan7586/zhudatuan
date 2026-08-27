/**
 * 智慧翼企业福利商城 - 购物车 CartPage screen
 * 按供应商 (平台自营/京东API/集团) 分组、全选/单选控制、履约试算与合并拆单结算
 * 技术服务方：雍彻科技
 */

import React, { useMemo } from 'react';
import { useMall } from '../context/MallContext';
import { CartItem } from '../types';
import { ShoppingCart, Trash2, ArrowRight, ChevronRight, RefreshCw } from 'lucide-react';
import { getOutOfStockActionHint } from '../utils/inventory';

export const CartPage: React.FC = () => {
  const { cart, updateCartQuantity, toggleCartItemSelected, toggleSelectAllCart, removeCartItem, navigateTo, user, showToast } = useMall();

  // Group cart items by supplier
  const groupedCart = useMemo(() => {
    const map = new Map<string, { supplierName: string; supplierType: string; items: CartItem[] }>();
    cart.forEach((item) => {
      const key = item.product.supplierId;
      if (!map.has(key)) {
        map.set(key, {
          supplierName: item.product.supplierName,
          supplierType: item.product.supplierType,
          items: [],
        });
      }
      map.get(key)!.items.push(item);
    });
    return Array.from(map.values());
  }, [cart]);

  // Selected items & totals
  const selectedItems = useMemo(() => cart.filter((i) => i.selected), [cart]);

  const isAllSelected = cart.length > 0 && cart.every((i) => i.selected);
  const outOfStockSelectedCount = selectedItems.filter((item) => item.quantity > item.product.stock || item.product.stock <= 0).length;
  const outOfStockItems = selectedItems.filter((item) => item.quantity > item.product.stock || item.product.stock <= 0);
  const hasInvalidSelection = outOfStockSelectedCount > 0;
  const canSubmit = selectedItems.length > 0 && !hasInvalidSelection;

  const totalGoodsAmount = useMemo(() => {
    return selectedItems.reduce((sum, i) => sum + i.product.priceWelfare * i.quantity, 0);
  }, [selectedItems]);

  // Estimated welfare & meal deduction simulation
  const estWelfareDeduct = Math.min(totalGoodsAmount, user.welfareBalance);
  const remForMeal = totalGoodsAmount - estWelfareDeduct;
  const estMealDeduct = Math.min(remForMeal, user.mealBalance);
  const estWechatTopUp = Math.max(0, totalGoodsAmount - estWelfareDeduct - estMealDeduct);

  const handleClearInvalidItems = () => {
    if (outOfStockItems.length === 0) return;
    outOfStockItems.forEach((item) => {
      removeCartItem(item.id);
    });
    showToast('已为您移除异常商品，购物车可重新选购。', 'success');
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-12 text-center font-sans space-y-4">
        <div className="w-20 h-20 bg-blue-50 text-[var(--sw-brand)] rounded-full flex items-center justify-center mx-auto shadow-xs">
          <ShoppingCart className="w-10 h-10" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">您的福利购物车空空如也</h2>
        <p className="text-xs text-gray-400">快去选购优质福利商品、电影票或使用福利卡兑换卡券吧！</p>
        <button onClick={() => navigateTo('home')} className="bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded shadow-sm transition-colors">
          返回商城首页选购
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-4 font-sans">
      {/* 1. 顶部步骤条与全选 */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-md p-4 shadow-xs text-xs">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
            <input type="checkbox" checked={isAllSelected} onChange={(e) => toggleSelectAllCart(e.target.checked)} className="w-4 h-4 text-[var(--sw-brand)] rounded" />
            <span>全选所有商品 ({cart.length}件)</span>
          </label>
        </div>

        <div className="flex items-center gap-2 text-gray-500">
          <span className="text-[var(--sw-brand)] font-bold">1. 选购与勾选</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>2. 拆单与福利扣减确认</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>3. 完成兑换/配送</span>
        </div>

        {hasInvalidSelection ? (
          <button onClick={handleClearInvalidItems} className="text-red-600 hover:text-red-700 underline flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            一键移除 {outOfStockSelectedCount} 件异常商品
          </button>
        ) : null}
      </div>

      {/* 2. 购物车按供应商分组列表 */}
      <div className="space-y-4">
        {groupedCart.map((group) => {
          const isGroupAllSelected = group.items.every((i) => i.selected);

          return (
            <div key={group.supplierName} className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-xs">
              {/* 供应商分组包头 */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isGroupAllSelected}
                    onChange={(e) => {
                      group.items.forEach((item) => {
                        if (item.selected !== e.target.checked) {
                          toggleCartItemSelected(item.id);
                        }
                      });
                    }}
                    className="w-4 h-4 text-[var(--sw-brand)] rounded"
                  />
                  <span className="bg-[var(--sw-brand)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{group.supplierName}</span>
                  <span className="font-bold text-gray-900">{group.supplierName}</span>
                  <span className="text-gray-400 text-[11px]">(结算时将自动拆分为独立子订单)</span>
                </div>

                <span className="text-gray-400 text-[11px]">共 {group.items.length} 项商品</span>
              </div>

              {/* 商品项 */}
              <div className="divide-y divide-gray-100">
                {group.items.map((item) => (
                  <div key={item.id} className={`p-4 flex items-center gap-4 text-xs transition-colors ${item.selected ? 'bg-blue-50/20' : 'bg-white'}`}>
                    <input type="checkbox" checked={item.selected} onChange={() => toggleCartItemSelected(item.id)} className="w-4 h-4 text-[var(--sw-brand)] rounded cursor-pointer" />

                    <img
                      src={item.product.images[0]}
                      alt={item.product.title}
                      className="w-20 h-20 rounded object-cover border border-gray-200 flex-shrink-0 cursor-pointer"
                      onClick={() => navigateTo('detail', { productId: item.product.id })}
                    />

                    <div className="flex-1 space-y-1">
                      <h3 onClick={() => navigateTo('detail', { productId: item.product.id })} className="font-bold text-gray-900 hover:text-[var(--sw-brand)] cursor-pointer line-clamp-1">
                        {item.product.title}
                      </h3>

                      <div className="text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded inline-block">
                        规格：
                        {Object.entries(item.selectedSpec)
                          .map(([k, v]) => `${k}:${v}`)
                          .join(' ') || '默认规'}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-1">
                        <span>履约：{item.product.deliverySla}</span>
                        {item.product.allowedAccounts.includes('welfare') && <span className="text-[var(--sw-brand)] font-semibold">支持福利卡抵扣</span>}
                        {item.product.allowedAccounts.includes('meal') && <span className="text-[#FF7A00] font-semibold">支持餐卡</span>}
                      </div>
                    </div>

                    {/* 单价与数量调整 */}
                    <div className="text-right space-y-1 min-w-[120px]">
                      <div className="text-[#FF7A00] font-black text-sm">¥{item.product.priceWelfare.toFixed(2)}</div>
                      <div className="text-gray-400 text-[11px] line-through">¥{item.product.priceMarket.toFixed(2)}</div>
                    </div>

                    <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                      <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 font-bold">
                        -
                      </button>
                      <span className="px-3 py-1 font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock}
                        className={`px-2 py-1 bg-gray-100 font-bold ${item.quantity >= item.product.stock ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-200'}`}
                      >
                        +
                      </button>
                    </div>

                    {item.quantity > item.product.stock || item.product.stock <= 0 ? (
                      <button onClick={() => navigateTo('detail', { productId: item.product.id })} className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5 hover:bg-red-100">
                        库存不足，请调整数量
                      </button>
                    ) : null}

                    <div className="text-right min-w-[100px] font-black text-[#FF7A00] text-sm">¥{(item.product.priceWelfare * item.quantity).toFixed(2)}</div>

                    <button onClick={() => removeCartItem(item.id)} className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors" title="移除商品">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. 底部固定结算面板 */}
      <div className="sticky bottom-0 bg-white border border-gray-300 rounded-md shadow-2xl p-4 z-30 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
            <input type="checkbox" checked={isAllSelected} onChange={(e) => toggleSelectAllCart(e.target.checked)} className="w-4 h-4 text-[var(--sw-brand)] rounded" />
            <span>全选</span>
          </label>

          <span className="text-gray-500">
            已选中 <strong className="text-[var(--sw-brand)]">{selectedItems.length}</strong> 件商品
          </span>
        </div>

        {/* 预估扣减明细与微信补差试算 */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-right space-y-0.5">
            {hasInvalidSelection && <div className="text-red-600 text-[11px] font-bold">{getOutOfStockActionHint(outOfStockSelectedCount)}</div>}
            <div className="flex items-baseline gap-1">
              <span className="text-gray-600 font-bold">商品总计：</span>
              <span className="text-xl font-black text-[#FF7A00]">¥{totalGoodsAmount.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-end gap-3 text-[11px] text-gray-500">
              <span>
                福利卡预扣: <strong className="text-[var(--sw-brand)]">¥{estWelfareDeduct.toFixed(2)}</strong>
              </span>
              <span>
                餐卡预扣: <strong className="text-[#FF7A00]">¥{estMealDeduct.toFixed(2)}</strong>
              </span>
              {estWechatTopUp > 0 && <span className="text-red-600 font-bold">微信需补差: ¥{estWechatTopUp.toFixed(2)}</span>}
            </div>
          </div>

          <button
            disabled={!canSubmit}
            onClick={() => navigateTo('checkout')}
            className="bg-[var(--sw-brand)] hover:bg-blue-700 disabled:opacity-40 text-white font-black px-8 py-3 rounded text-sm shadow-md transition-colors cursor-pointer flex items-center gap-2"
          >
            <span>{selectedItems.length === 0 ? '请先选择商品' : hasInvalidSelection ? `先修正 ${outOfStockSelectedCount} 件异常` : '去确认订单 >'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
