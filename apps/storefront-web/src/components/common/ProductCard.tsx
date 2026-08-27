/**
 * 智慧翼企业福利商城 - 高信息密度商品卡片组件
 * 展示商品图、市场价/商城价/企业福利价、可用福利卡/餐卡类型、履约时效与加购
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { Product } from '../../types';
import { useMall } from '../../context/MallContext';
import { ShoppingCart, Heart, CreditCard, Utensils, Truck, Eye, Star } from 'lucide-react';
import { getInventoryStatus } from '../../utils/inventory';

interface ProductCardProps {
  product: Product;
  compact?: boolean;
  showCompare?: boolean;
  inCompare?: boolean;
  onToggleCompare?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, compact = false, showCompare = false, inCompare = false, onToggleCompare }) => {
  const { navigateTo, addToCart, favorites, toggleFavorite, setQuickViewProduct } = useMall();

  const isFav = favorites.includes(product.id);
  const inventory = getInventoryStatus(product.stock, Boolean(product.isTest));

  const isWelfareAllowed = product.allowedAccounts.includes('welfare');
  const isMealAllowed = product.allowedAccounts.includes('meal');
  const canAddToCart = inventory.canPurchase;
  const isLowStock = inventory.canPurchase && product.stock > 0 && product.stock <= 3;

  const getSupplierBadgeStyle = () => {
    switch (product.supplierType) {
      case 'self_operated':
        return 'bg-[var(--sw-brand)] text-white';
      case 'group_owned':
        return 'bg-[var(--sw-brand-dark)] text-yellow-300';
      default:
        return 'bg-gray-800 text-white';
    }
  };

  const getItemTypeBadge = () => {
    switch (product.itemType) {
      case 'movie_ticket':
        return <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded font-medium">电影票通兑</span>;
      case 'virtual_coupon':
        return <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded font-medium">虚拟卡券</span>;
      case 'supermarket':
        return <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-medium">商超好卡</span>;
      case 'nearby_store':
        return <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-medium">门店核销</span>;
      case 'life_service':
        return <span className="bg-teal-100 text-teal-700 text-[10px] px-1.5 py-0.5 rounded font-medium">生活服务</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden hover:border-blue-400 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group relative">
      <div className="relative aspect-square overflow-hidden bg-gray-50 cursor-pointer" onClick={() => navigateTo('detail', { productId: product.id })}>
        <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />

        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs ${getSupplierBadgeStyle()}`}>{product.supplierName}</span>
          {product.isTest && <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">非商业测试</span>}
          {getItemTypeBadge()}
        </div>

        <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(product.id);
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all cursor-pointer ${isFav ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-600 hover:bg-white'}`}
            title={isFav ? '已收藏' : '加入收藏'}
          >
            <Heart className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuickViewProduct(product);
            }}
            className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-gray-700 flex items-center justify-center shadow-md transition-all cursor-pointer"
            title="快速预览"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2 py-1 flex items-center justify-between">
          <span className="flex items-center gap-1 font-medium truncate">
            <Truck className="w-3 h-3 text-blue-300 flex-shrink-0" />
            <span className="truncate">{product.deliverySla}</span>
          </span>
          <span className="text-gray-300 text-[10px] flex-shrink-0">已售 {product.salesCount >= 10000 ? `${(product.salesCount / 10000).toFixed(1)}万` : product.salesCount}</span>
        </div>

        {!canAddToCart && <span className="absolute inset-0 bg-white/75 backdrop-blur-sm text-red-700 font-bold text-xs flex items-center justify-center">{`${inventory.badgeText}，暂不支持购买`}</span>}
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between gap-2 text-left">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {isWelfareAllowed && (
              <span className="inline-flex items-center gap-0.5 bg-blue-50 text-[var(--sw-brand)] text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-200">
                <CreditCard className="w-3 h-3" />
                福利卡抵扣
              </span>
            )}
            {isMealAllowed && (
              <span className="inline-flex items-center gap-0.5 bg-orange-50 text-[#FF7A00] text-[10px] font-bold px-1.5 py-0.5 rounded border border-orange-200">
                <Utensils className="w-3 h-3" />
                餐卡可用
              </span>
            )}
            {product.isEnterpriseExclusive && <span className="bg-[var(--sw-brand-dark)] text-white text-[10px] px-1.5 py-0.5 rounded font-bold">企业专享价</span>}
          </div>

          <h3 onClick={() => navigateTo('detail', { productId: product.id })} className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug cursor-pointer hover:text-[var(--sw-brand)] transition-colors">
            {product.title}
          </h3>

          <p className="text-[11px] text-gray-400 line-clamp-1 mt-1 font-normal">{product.subtitle}</p>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-[#FFB020] text-[#FFB020]" />
              {product.rating.toFixed(1)} ({product.reviewCount}条)
            </span>
            {isLowStock ? <span className="text-red-600 font-medium">低库存仅余 {product.stock} 件</span> : null}
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100">
          {product.isTest ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-700">测试数据 · 不提供购买</span>
              <span className="rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700">TEST</span>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-[#FF7A00] font-black">企业福利价</span>
                  <span className="text-lg font-black text-[#FF7A00]">¥{product.priceWelfare.toFixed(2)}</span>
                </div>

                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    canAddToCart && addToCart(product, 1, product.specs?.[0] ? { [product.specs[0].name]: product.specs[0].options[0] } : {});
                  }}
                  disabled={!canAddToCart}
                  className={`text-white p-1.5 rounded transition-colors flex items-center justify-center shadow-xs ${canAddToCart ? 'bg-[var(--sw-brand)] hover:bg-blue-700 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'}`}
                  title={canAddToCart ? '加入购物车' : inventory.actionButtonStateText}
                >
                  <ShoppingCart className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                <span className="line-through">市场价 ¥{product.priceMarket.toFixed(2)}</span>
                <span>商城价 ¥{product.priceMall.toFixed(2)}</span>
              </div>

              <div className="text-[11px] mt-1 text-gray-500 flex items-center justify-between">
                <span>库存：{inventory.stockText}</span>
                {inventory.canPurchase && <span className="text-emerald-600">可下单</span>}
              </div>
              {showCompare && onToggleCompare ? (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleCompare();
                  }}
                  className={`text-[11px] mt-1 px-2 py-1 rounded border w-full flex items-center justify-center ${inCompare ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {inCompare ? '已加入对比' : '加入对比'}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
