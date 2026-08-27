import React, { useEffect, useMemo, useState } from 'react';
import { useMall } from '../context/MallContext';
import { ProductCard } from '../components/common/ProductCard';
import { ProductDetailTabs } from '../features/product/ProductDetailTabs';
import { Truck, CreditCard, Utensils, ChevronRight, Star, MapPin, Store, AlertCircle } from 'lucide-react';
import { getInventoryStatus, getOutOfStockActionHint } from '../utils/inventory';
import { ProductDetailActionPanel } from '../features/product/ProductDetailActionPanel';
import type { Product } from '../types';
import { MissingCatalogProduct } from '../components/common/CatalogAvailability';
export const ProductDetailPage: React.FC = () => {
  const { routeParams, navigateTo, products, catalogSyncStatus } = useMall();
  const productId = routeParams.productId;
  const product = productId ? products.find((item) => item.id === productId) : undefined;
  if (!product) {
    return <MissingCatalogProduct catalogSyncStatus={catalogSyncStatus} onBack={() => navigateTo('home')} />;
  }
  return <ProductDetailContent product={product} />;
};
const ProductDetailContent: React.FC<{ product: Product }> = ({ product }) => {
  const { navigateTo, addToCart, user, addresses, favorites, toggleFavorite, products, sessionStatus, showToast } = useMall();
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (product.specs) {
      product.specs.forEach((s) => {
        initial[s.name] = s.options[0];
      });
    }
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'detail' | 'params' | 'reviews' | 'aftersale'>('detail');
  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id || 'addr_01');
  const isFav = favorites.includes(product.id);
  const inventory = getInventoryStatus(product.stock, Boolean(product.isTest));
  const selectedAddress = useMemo(() => addresses.find((address) => address.id === selectedAddressId), [addresses, selectedAddressId]);
  const specsMissing = useMemo(() => (product.specs ? product.specs.some((spec) => !selectedSpecs[spec.name]) : false), [product.specs, selectedSpecs]);
  const payableAmount = useMemo(() => product.priceWelfare * quantity, [product.priceWelfare, quantity]);
  const canCoverByAccounts = useMemo(() => user.welfareBalance + user.mealBalance >= payableAmount, [payableAmount, user.mealBalance, user.welfareBalance]);
  const canUsePaymentMethod = useMemo(() => product.allowedAccounts.includes('welfare') || product.allowedAccounts.includes('meal'), [product.allowedAccounts]);
  const isAuthenticated = sessionStatus === 'authenticated';
  const buyBlocker = useMemo(() => {
    if (!inventory.canPurchase) return inventory.actionButtonStateText;
    if (specsMissing) return '请先选择完整规格后再提交';
    if (addresses.length === 0 || !selectedAddress) return '请先选择或新增收货地址';
    if (!canUsePaymentMethod) return '该商品暂未开放福利/餐卡支付';
    if (!isAuthenticated) return '请先点击顶部“登录账户”后再提交订单';
    if (!canCoverByAccounts) return '账户余额不足，建议返回结算页确认支付方式';
    return '';
  }, [addresses.length, canCoverByAccounts, canUsePaymentMethod, inventory, isAuthenticated, selectedAddress, specsMissing]);
  const similarProducts = products
    .filter((item) => item.categoryId === product.categoryId)
    .filter((p) => p.id !== product.id)
    .slice(0, 5);

  const handleBuyNow = () => {
    if (buyBlocker) {
      showToast(buyBlocker, 'warning');
      return;
    }
    addToCart(product, quantity, selectedSpecs);
    navigateTo('checkout');
  };

  const handleAddToCart = () => {
    if (product.isTest || !inventory.canPurchase) return;
    if (specsMissing) {
      showToast('请先完成规格选择后再加入购物车', 'warning');
      return;
    }
    addToCart(product, quantity, selectedSpecs);
  };

  useEffect(() => {
    const safeQuantity = Math.min(Math.max(1, product.stock > 0 ? product.stock : 1), quantity);
    if (safeQuantity !== quantity) {
      setQuantity(safeQuantity);
    }
  }, [product.stock, quantity]);

  useEffect(() => {
    if (addresses.length === 0) {
      setSelectedAddressId('addr_01');
      return;
    }
    if (!selectedAddress) {
      setSelectedAddressId(addresses[0].id);
    }
  }, [addresses, selectedAddress]);

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-6 font-sans">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <button onClick={() => navigateTo('home')} className="hover:text-[var(--sw-brand)]">
          首页
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <button onClick={() => navigateTo('category', { categoryId: product.categoryId })} className="hover:text-[var(--sw-brand)]">
          {product.categoryName}
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <span className="font-semibold text-gray-900 truncate max-w-xs">{product.title}</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-5 space-y-3">
          <div className="aspect-square bg-gray-50 rounded-md overflow-hidden border border-gray-200 relative">
            <img src={product.images[selectedImgIndex] || product.images[0]} alt={product.title} className="w-full h-full object-cover" />
            <div className="absolute top-3 left-3 bg-[var(--sw-brand)] text-white text-xs font-bold px-2 py-0.5 rounded shadow-xs">{product.supplierName}</div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImgIndex(idx)}
                className={`w-16 h-16 rounded border-2 overflow-hidden flex-shrink-0 cursor-pointer transition-all ${selectedImgIndex === idx ? 'border-[var(--sw-brand)]' : 'border-gray-200 opacity-70 hover:opacity-100'}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-12 md:col-span-7 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-[var(--sw-brand-dark)] text-white text-xs font-bold px-2 py-0.5 rounded">{product.brand}</span>
              <span className="text-xs text-gray-500">累计销量 {product.salesCount} 件</span>
              <span className="text-xs text-amber-500 font-bold flex items-center gap-0.5 ml-auto">
                <Star className="w-3.5 h-3.5 fill-current" /> {product.rating} ({product.reviewCount}条好评)
              </span>
            </div>

            <h1 className="text-lg font-black text-gray-900 leading-snug">{product.title}</h1>
            <p className="text-xs text-gray-500 mt-1">{product.subtitle}</p>

            <div className="bg-[var(--sw-brand-light)] border border-blue-200 rounded-md p-4 mt-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-[#FF7A00] font-bold">企业福利专享价：</span>
                  <span className="text-3xl font-black text-[#FF7A00] ml-1">¥{product.priceWelfare.toFixed(2)}</span>
                </div>

                <div className="text-right text-xs text-gray-500 space-y-0.5">
                  <div>
                    市场划线价: <span className="line-through">¥{product.priceMarket.toFixed(2)}</span>
                  </div>
                  <div>商城日常价: ¥{product.priceMall.toFixed(2)}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-blue-200/60 flex items-center gap-3 text-xs text-blue-900">
                <span className="font-bold flex-shrink-0">可用福利：</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {product.allowedAccounts.includes('welfare') && (
                    <span className="bg-white border border-blue-300 text-[var(--sw-brand)] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                      <CreditCard className="w-3.5 h-3.5" /> 福利卡全额/混合抵扣 (余额: ¥{user.welfareBalance.toFixed(2)})
                    </span>
                  )}
                  {product.allowedAccounts.includes('meal') && (
                    <span className="bg-white border border-orange-300 text-[#FF7A00] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                      <Utensils className="w-3.5 h-3.5" /> 餐卡可用 (余额: ¥{user.mealBalance.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="w-20 text-gray-500">库存状态</span>
                <span className={`font-bold ${inventory.canPurchase ? 'text-[var(--sw-brand)]' : 'text-red-600'}`}>{inventory.stockText}</span>
              </div>
            </div>

            <div className="mt-4 text-xs space-y-2 border-t border-b border-gray-100 py-3">
              <div className="flex items-center gap-3 text-gray-700">
                <span className="w-20 text-gray-500 font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  配送至：
                </span>
                <select value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)} className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none max-w-md">
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.province}
                      {a.city}
                      {a.district}
                      {a.detail} ({a.name} 收)
                    </option>
                  ))}
                  {addresses.length === 0 && <option value="addr_01">暂无收货地址（请先新增）</option>}
                </select>
              </div>

              <div className="flex items-center gap-3 text-gray-700">
                <span className="w-20 text-gray-500 font-bold flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-green-600" />
                  履约服务：
                </span>
                <span className="font-bold text-gray-900">{product.deliverySla}</span>
                <span className="text-gray-400">|</span>
                <span className={`font-semibold ${inventory.canPurchase ? 'text-green-700' : 'text-red-600'}`}>{inventory.availabilityText}</span>
              </div>

              {product.nearbyStoreInfo && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900 mt-2">
                  <div className="font-bold flex items-center gap-1">
                    <Store className="w-4 h-4 text-amber-600" /> 核销门店：
                    {product.nearbyStoreInfo.storeName}
                  </div>
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    地址：{product.nearbyStoreInfo.address} (距您{product.nearbyStoreInfo.distance}) · 营业时间：
                    {product.nearbyStoreInfo.businessHours}
                  </div>
                </div>
              )}
            </div>

            {product.specs && product.specs.length > 0 && (
              <div className="mt-4 space-y-3">
                {product.specs.map((spec) => (
                  <div key={spec.name} className="flex items-start gap-3 text-xs">
                    <span className="w-20 text-gray-500 font-bold pt-1">{spec.name}：</span>
                    <div className="flex flex-wrap gap-2 flex-1">
                      {spec.options.map((opt) => {
                        const isSelected = selectedSpecs[spec.name] === opt;
                        return (
                          <button
                            key={opt}
                            onClick={() => setSelectedSpecs((prev) => ({ ...prev, [spec.name]: opt }))}
                            className={`px-3 py-1.5 rounded border text-xs font-medium cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50 border-[var(--sw-brand)] text-[var(--sw-brand)] font-bold shadow-2xs' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-3 text-xs">
              <span className="w-20 text-gray-500 font-bold">采购数量：</span>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 font-bold">
                  -
                </button>
                <span className="px-4 py-1 font-bold">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock || product.stock <= 0}
                  className={`px-3 py-1 font-bold ${quantity >= product.stock || product.stock <= 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  +
                </button>
              </div>
              <span className="text-gray-400">
                (小计金额：
                <strong className="text-[#FF7A00]">¥{(product.priceWelfare * quantity).toFixed(2)}</strong>)
              </span>
            </div>

            {!inventory.canPurchase ? (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {product.isTest ? inventory.actionButtonStateText : getOutOfStockActionHint(1)}
              </div>
            ) : null}
          </div>

          <ProductDetailActionPanel
            payableAmount={payableAmount}
            accountBalance={user.welfareBalance + user.mealBalance}
            buyBlocker={buyBlocker}
            isFav={isFav}
            canAddToCart={inventory.canPurchase && !specsMissing && !product.isTest}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            onToggleFavorite={() => toggleFavorite(product.id)}
          />
        </div>
      </div>

      <ProductDetailTabs product={product} activeTab={activeTab} setActiveTab={setActiveTab} />
      {similarProducts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
          <div className="font-bold text-base text-gray-900 border-b border-gray-100 pb-2">同类福利选购推荐</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {similarProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
