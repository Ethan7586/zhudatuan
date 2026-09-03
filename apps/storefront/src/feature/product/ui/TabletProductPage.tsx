import { CheckCircle2, CreditCard, Heart, Minus, Plus, Share2, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { chineseDomainList } from '@shop/presentation';
import { useState } from 'react';
import { useProductRuntime } from '../application/ProductRuntime';
import { formatMinor } from '../../../shared/format/Money';

export function TabletProductPage() {
  const { quickViewProduct, presentationProducts, addToCart, setLaptopPage, favorites, toggleFavorite, shareProduct } = useProductRuntime();
  const [quantity, setQuantity] = useState(1);
  const product = quickViewProduct ?? presentationProducts[0];
  if (!product) return <div className="grid min-h-[70dvh] place-items-center text-slate-500">暂无可查看商品</div>;
  return (
    <div className="mx-auto max-w-6xl p-5">
      <section className="grid grid-cols-2 gap-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="relative overflow-hidden rounded-2xl bg-slate-100">
          {product.images[0] ? <img src={product.images[0]} alt={product.title} className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center text-xs text-slate-400">商品暂未发布图片</div>}
          <div className="absolute right-3 top-3 flex gap-2">
            <button type="button" onClick={() => toggleFavorite(product.id)} className="grid h-10 w-10 place-items-center rounded-full bg-white/90" aria-label="收藏">
              <Heart size={19} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} />
            </button>
            <button type="button" onClick={() => void shareProduct(product)} className="grid h-10 w-10 place-items-center rounded-full bg-white/90" aria-label="分享">
              <Share2 size={19} />
            </button>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">当前商城已发布</span>
          <h1 className="mt-4 text-2xl font-black leading-9">{product.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{product.subtitle}</p>
          <div className="mt-5">
            <span className="text-sm text-red-500">¥</span>
            <span className="text-3xl font-black text-red-500">{formatMinor(product.priceWelfareMinor)}</span>
            <span className="ml-2 text-sm text-slate-400 line-through">¥{formatMinor(product.priceMarketMinor)}</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            <span className="flex items-center gap-1 rounded-xl bg-emerald-50 p-2 text-emerald-700">
              <ShieldCheck size={15} />
              来源以发布记录为准
            </span>
            <span className="flex items-center gap-1 rounded-xl bg-blue-50 p-2 text-blue-700">
              <Truck size={15} />
              {product.deliverySla || '履约时效以结算及订单记录为准'}
            </span>
            <span className="flex items-center gap-1 rounded-xl bg-amber-50 p-2 text-amber-700">
              <CreditCard size={15} />
              {product.allowedAccounts.length > 0 ? chineseDomainList(product.allowedAccounts) : '报价确认账户'}
            </span>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
            <span className="text-sm font-bold">购买数量</span>
            <div className="flex overflow-hidden rounded-xl border bg-white">
              <button type="button" className="grid h-9 w-9 place-items-center" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                <Minus size={14} />
              </button>
              <span className="grid min-w-10 place-items-center border-x">{quantity}</span>
              <button type="button" className="grid h-9 w-9 place-items-center" onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))}>
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="mt-auto flex gap-3 pt-5">
            <button
              type="button"
              disabled={!product.purchasable || product.stock < 1}
              onClick={() => {
                addToCart(product, quantity);
                setLaptopPage('cart');
              }}
              className="h-12 flex-1 rounded-2xl border-2 border-blue-600 font-black text-blue-600 disabled:opacity-40"
            >
              加入购物车
            </button>
            <button
              type="button"
              disabled={!product.purchasable || product.stock < 1}
              onClick={() => {
                addToCart(product, quantity);
                setLaptopPage('cart');
              }}
              className="h-12 flex-1 rounded-2xl bg-blue-600 font-black text-white disabled:opacity-40"
            >
              立即兑换
            </button>
          </div>
        </div>
      </section>
      <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="font-black">商品服务与详情</h2>
        <div className="mt-4 flex gap-6 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="text-emerald-500" size={16} />
            企业购买资格实时校验
          </span>
          <span className="flex items-center gap-1">
            <ShoppingCart className="text-blue-500" size={16} />
            购物车版本一致性保护
          </span>
        </div>
      </section>
    </div>
  );
}
