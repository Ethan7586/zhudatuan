/**
 * 商品详情页下部：采购卡片、结算提示与行动按钮
 */
import React from 'react';
import { ShoppingCart, Heart, ShieldCheck } from 'lucide-react';

interface ProductDetailActionPanelProps {
  payableAmount: number;
  accountBalance: number;
  buyBlocker: string;
  isFav: boolean;
  canAddToCart: boolean;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onToggleFavorite: () => void;
}

export const ProductDetailActionPanel: React.FC<ProductDetailActionPanelProps> = ({ payableAmount, accountBalance, buyBlocker, isFav, canAddToCart, onAddToCart, onBuyNow, onToggleFavorite }) => {
  return (
    <>
      <div className={`mt-2 rounded border p-2.5 text-xs ${buyBlocker ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
        <div>
          预计支付总额 <strong className="text-[#FF7A00]">¥{payableAmount.toFixed(2)}</strong> ｜ 账户可用
          <strong className="text-[var(--sw-brand)] ml-1">¥{accountBalance.toFixed(2)}</strong>
        </div>
        {buyBlocker ? <div>• {buyBlocker}</div> : <div>• 当前已满足下单前提，可直接前往结算页</div>}
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={onAddToCart}
          disabled={!canAddToCart}
          className="flex-1 bg-blue-50 hover:bg-blue-100 text-[var(--sw-brand)] border border-blue-300 font-black py-3 rounded text-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="w-4 h-4 inline-block mr-1.5" />
          加入购物车
        </button>

        <button
          onClick={onBuyNow}
          disabled={Boolean(buyBlocker)}
          className="flex-1 bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-black py-3 rounded text-sm transition-colors cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {buyBlocker ? '请先完成前置条件' : '立即兑换 / 确认提交'}
        </button>

        <button
          onClick={onToggleFavorite}
          className={`p-3 rounded border transition-colors cursor-pointer ${isFav ? 'bg-red-50 border-red-200 text-red-500' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          title={isFav ? '已收藏' : '加入收藏'}
        >
          <Heart className="w-5 h-5 fill-current" />
        </button>
      </div>

      <div className="pt-4 border-t border-gray-100 space-y-2 text-xs text-gray-500">
        <div className="font-bold text-gray-900 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          保障说明
        </div>
        <div>• 订单支付与库存将在提交时再次核验，避免无货风险。</div>
        <div>• 实物商品需确认收货后自动触发最终核销；虚拟权益会在订单状态更新后自动发码。</div>
        <div>• 如库存发生变动，以订单提交时平台快照为准，未发货会返回可用补偿方案。</div>
      </div>
    </>
  );
};
