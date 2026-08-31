import React, { useState } from 'react';
import { LaptopBreadcrumb } from '../../../shared/ui/Breadcrumb';
import { useProductRuntime } from '../application/ProductRuntime';
import type { LaptopPage } from '../../../shared/manifest/StorefrontRoute';
import { ShoppingCart, Zap, CreditCard, Gift, ShieldCheck, Truck, CheckCircle2, MapPin, Minus, Plus, Heart, Share2 } from 'lucide-react';
import { defaultStorefrontWebPage, type StorefrontWebSurface } from '../../../shared/ui/StorefrontPresentation';
import { formatMinor } from '../../../shared/format/Money';

interface LaptopDetailPageProps {
  onSelectTab: (tab: LaptopPage) => void;
  surface?: StorefrontWebSurface;
}

export const LaptopDetailPage: React.FC<LaptopDetailPageProps> = ({ onSelectTab, surface = 'standard' }) => {
  const { user, addresses, addToCart, presentationProducts: products, quickViewProduct, favorites, toggleFavorite, shareProduct } = useProductRuntime();
  const homePage = defaultStorefrontWebPage(surface);

  const product = products.find(({ id }) => id === quickViewProduct?.id) ?? products[0];
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedSpec, setSelectedSpec] = useState<string>('');
  type DetailTab = 'detail' | 'spec' | 'aftersale';
  const [activeTab, setActiveTab] = useState<DetailTab>('detail');
  const tabs: ReadonlyArray<Readonly<{ id: DetailTab; name: string }>> = [
    { id: 'detail', name: '商品详情' },
    { id: 'spec', name: '规格参数' },
    { id: 'aftersale', name: '售后与发票' },
  ];

  if (!product)
    return (
      <main className="grid min-h-[60dvh] place-items-center text-sm text-gray-500" role="status">
        暂无可查看商品
      </main>
    );
  const specificationOptions = product.specs?.flatMap(({ name, options }) => options.map((option) => `${name}：${option}`)) ?? [];
  const deliveryAddress = addresses[0];

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    onSelectTab('cart');
  };

  return (
    <div className="w-full bg-[var(--sw-background)] min-h-[80vh] pb-8 font-sans">
      <div className="sw-web-container max-w-[1240px] mx-auto pt-3 px-3 space-y-3">
        <LaptopBreadcrumb productTitle={product.title} onSelectTab={onSelectTab} homePage={homePage} />

        <div className="sw-web-detail-grid bg-white border border-gray-200 rounded-lg p-4 shadow-2xs grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="sw-web-detail-media w-full h-[300px] bg-gray-50 rounded-lg border border-gray-200 p-4 flex items-center justify-center relative overflow-hidden">
              <span className="absolute top-2 left-2 bg-[var(--sw-promotion)] text-white text-[10px] font-black px-2 py-0.5 rounded shadow-2xs">
                {product.enterpriseSubsidyAmount > 0 ? `较参考价优惠 ¥${product.enterpriseSubsidyAmount.toFixed(2)}` : '商城当前价'}
              </span>
              <div className="absolute right-2 top-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleFavorite(product.id)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white/95 text-gray-600 shadow-sm transition-colors hover:border-red-200 hover:text-red-500"
                  aria-label={favorites.includes(product.id) ? '取消收藏商品' : '收藏商品'}
                  title={favorites.includes(product.id) ? '取消收藏' : '收藏商品'}
                >
                  <Heart className="h-4 w-4" fill={favorites.includes(product.id) ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  onClick={() => void shareProduct(product)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white/95 text-gray-600 shadow-sm transition-colors hover:border-blue-200 hover:text-[var(--sw-brand)]"
                  aria-label="分享商品"
                  title="分享商品"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
              {product.image ? <img src={product.image} alt={product.title} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-gray-400">商品暂未发布图片</span>}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[product.image, ...product.gallery].filter(Boolean).map((img) => (
                <div key={img} className="w-14 h-14 rounded border-2 border-[var(--sw-brand)] bg-gray-50 p-1 flex-shrink-0">
                  <img src={img} alt={product.title} className="w-full h-full object-contain" />
                </div>
              ))}
            </div>

            <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-2.5 grid grid-cols-3 gap-2 text-[11px] text-gray-700 text-center">
              <div className="flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--sw-brand)]" />
                <span>开票以订单记录为准</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{product.purchasable ? `可售库存 ${product.stock}` : '当前不可购买'}</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <Truck className="w-3.5 h-3.5 text-amber-600" />
                <span>{product.deliverySla || '履约时效以结算及订单记录为准'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {product.supplierName ? <span className="bg-[var(--sw-brand-dark)] text-white font-bold text-[10px] px-1.5 py-0.2 rounded">{product.supplierName}</span> : null}
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">{product.allowedAccounts.length > 0 ? `可用账户：${product.allowedAccounts.join(' / ')}` : '账户资格以结算报价为准'}</span>
              </div>

              <h1 className="text-base sm:text-lg font-black text-gray-900 leading-snug">{product.title}</h1>
              <p className="text-xs text-gray-500 mt-1">{product.subtitle || product.description}</p>

              <div className="bg-gradient-to-r from-red-50 via-orange-50 to-blue-50 border border-red-200/80 rounded-lg p-3 mt-3 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-[var(--sw-promotion)]">企采福利价:</span>
                  <span className="text-2xl font-black text-[var(--sw-promotion)]">¥{product.welfarePrice.toFixed(2)}</span>
                  <span className="text-xs text-gray-400 line-through">官网原价 ¥{product.marketPrice.toFixed(2)}</span>
                </div>

                <div className="text-[11px] text-gray-700 flex items-center gap-3 pt-1 border-t border-red-100">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-[var(--sw-brand)]" />
                    <span>
                      {product.allowedAccounts.includes('welfare') ? (
                        <>
                          福利卡可用余额: <strong className="text-[var(--sw-brand-dark)]">¥{formatMinor(user.welfareBalanceMinor)}</strong>
                        </>
                      ) : (
                        '实际支付方式以服务端报价为准'
                      )}
                    </span>
                  </span>
                  {product.allowMealCard && (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Gift className="w-3.5 h-3.5" />
                      <span>餐卡支持</span>
                    </span>
                  )}
                </div>
              </div>

              {specificationOptions.length > 0 ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div className="font-bold text-gray-800">选择规格配置:</div>
                  <div className="flex flex-wrap gap-2">
                    {specificationOptions.map((spec) => (
                      <button
                        key={spec}
                        onClick={() => setSelectedSpec(spec)}
                        className={`px-3 py-1.5 rounded border text-xs font-bold transition-all cursor-pointer ${(selectedSpec || specificationOptions[0]) === spec ? 'border-[var(--sw-brand)] bg-blue-50 text-[var(--sw-brand)]' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 text-xs flex items-center gap-2 text-gray-700">
                <MapPin className="w-4 h-4 text-[var(--sw-brand)] flex-shrink-0" />
                <span>配送至：</span>
                <span className="font-bold text-gray-800">{deliveryAddress ? `${deliveryAddress.province}${deliveryAddress.city}${deliveryAddress.district}${deliveryAddress.detail}` : '结算时选择已加密收货地址'}</span>
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs">
                <span className="font-bold text-gray-800">购买数量:</span>
                <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 cursor-pointer">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="px-3 font-bold text-gray-800">{quantity}</span>
                  <button
                    disabled={quantity >= product.stock}
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!product.purchasable || product.stock < 1}
                className="flex-1 bg-blue-50 hover:bg-blue-100 border border-[var(--sw-brand)] text-[var(--sw-brand)] font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer shadow-2xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>加入购物车</span>
              </button>

              <button
                disabled={!product.purchasable || product.stock < 1}
                onClick={handleBuyNow}
                className="flex-1 bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-black py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Zap className="w-4 h-4 text-yellow-300" />
                <span>加入购物车并结算</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-bold text-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 transition-colors cursor-pointer border-b-2 ${activeTab === tab.id ? 'border-[var(--sw-brand)] bg-white text-[var(--sw-brand)]' : 'border-transparent hover:text-black'}`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          <div className="p-4 text-xs text-gray-700 leading-relaxed">
            {activeTab === 'detail' && (
              <div className="space-y-3">
                <p>{product.description || '该商品暂未发布额外说明。'}</p>
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded border border-gray-200">
                  <div>
                    <strong>品牌：</strong>
                    {product.brand || '以已发布商品信息为准'}
                  </div>
                  <div>
                    <strong>供应商：</strong>
                    {product.supplierName || '以已发布商品信息为准'}
                  </div>
                  <div>
                    <strong>发票：</strong>以实际开票资格、税率和已签发文件为准
                  </div>
                  <div>
                    <strong>支付：</strong>
                    {product.allowedAccounts.length > 0 ? product.allowedAccounts.join(' / ') : '以服务端报价为准'}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'spec' &&
              (product.params && product.params.length > 0 ? (
                <table className="w-full border-collapse text-left border border-gray-200">
                  <tbody>
                    {product.params.map(({ key, value }, index) => (
                      <tr key={key} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-50' : ''}`}>
                        <th className="p-2 w-1/4 font-bold">{key}</th>
                        <td className="p-2">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>该商品暂未发布额外规格参数，SKU 与价格版本以当前页面数据为准。</p>
              ))}

            {activeTab === 'aftersale' && (
              <div className="space-y-1.5">
                <p>售后资格、可申请数量、退货要求和预计退款金额由服务端按订单履约证据实时校验。</p>
                <p>电子发票仅在签发后进入订单发票记录，可从订单中心验证摘要并下载限时授权文件。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
