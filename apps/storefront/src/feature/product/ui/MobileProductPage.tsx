import { CheckCircle2, Heart, Minus, Plus, Share2, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { chineseReference } from '@shop/presentation';
import { useMemo, useState } from 'react';
import { useProductRuntime } from '../application/ProductRuntime';
import type { MobileChannel } from '../../../shared/manifest/StorefrontChannel';
import { formatMinor } from '../../../shared/format/Money';

export function MobileProductPage({ channel }: { readonly channel: MobileChannel }) {
  const { presentationProducts, quickViewProduct, addToCart, favorites, toggleFavorite, setLaptopPage, shareProduct } = useProductRuntime();
  const product = useMemo(() => quickViewProduct ?? presentationProducts[0] ?? null, [presentationProducts, quickViewProduct]);
  const [quantity, setQuantity] = useState(1);
  if (!product)
    return (
      <div className="grid min-h-[65dvh] place-items-center p-8 text-center">
        <div>
          <ShoppingCart className="mx-auto text-slate-300" size={40} />
          <p className="mt-3 text-sm font-bold">暂无可查看商品</p>
          <button type="button" onClick={() => setLaptopPage('category')} className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white">
            返回商品分类
          </button>
        </div>
      </div>
    );
  const favorite = favorites.includes(product.id);
  return (
    <div className="pb-20">
      <section className="relative bg-white">
        {product.images[0] ? (
          <img src={product.images[0]} alt={product.title} className="aspect-square w-full object-cover" />
        ) : (
          <div className="grid aspect-square place-items-center bg-slate-100 text-xs text-slate-400">商品暂未发布图片</div>
        )}
        <div className="absolute right-3 top-3 flex gap-2">
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white" onClick={() => toggleFavorite(product.id)} aria-label="收藏商品">
            <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
          </button>
          <button type="button" onClick={() => void shareProduct(product)} className="grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white" aria-label="分享商品">
            <Share2 size={18} />
          </button>
        </div>
        {product.images.length ? <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white">1/{product.images.length}</div> : null}
      </section>
      <section className="space-y-3 bg-white p-4">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-xs text-red-500">¥</span>
            <span className="text-2xl font-black text-red-500">{formatMinor(product.priceWelfareMinor)}</span>
            <span className="ml-2 text-xs text-slate-400 line-through">¥{formatMinor(product.priceMarketMinor)}</span>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${channel === 'android' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>企业福利价</span>
        </div>
        <h1 className="text-base font-black leading-6">{product.title}</h1>
        <p className="text-xs leading-5 text-slate-500">{product.subtitle}</p>
        <div className="flex flex-wrap gap-2 text-[10px] text-emerald-700">
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} />
            来源以发布记录为准
          </span>
          <span className="flex items-center gap-1">
            <Truck size={12} />
            {product.deliverySla || '履约时效以结算及订单记录为准'}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 size={12} />
            {product.purchasable ? '当前可购买' : '当前不可购买'}
          </span>
        </div>
      </section>
      <div className="h-2 bg-slate-100" />
      <section className="divide-y bg-white px-4 text-sm">
        <div className="flex w-full items-center justify-between py-4">
          <span>
            <b>规格</b>
            <span className="ml-3 text-slate-500">{product.specs?.flatMap(({ name, options }) => options.map((option) => `${name}：${option}`)).join('；') || chineseReference('商品规格', product.skuId)}</span>
          </span>
        </div>
        <div className="flex items-center justify-between py-4">
          <b>数量</b>
          <div className="flex items-center overflow-hidden rounded-lg border">
            <button type="button" className="grid h-8 w-8 place-items-center" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
              <Minus size={14} />
            </button>
            <span className="grid h-8 min-w-9 place-items-center border-x text-xs">{quantity}</span>
            <button type="button" className="grid h-8 w-8 place-items-center" onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))}>
              <Plus size={14} />
            </button>
          </div>
        </div>
      </section>
      <section className="mt-2 bg-white p-4">
        <h2 className="text-sm font-black">商品详情</h2>
        <div className="mt-3 space-y-2 text-xs leading-6 text-slate-600">
          {(product.descriptionDetailText ?? ['商品详情以供应商实际交付信息为准。']).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-[57px] z-40 mx-auto flex max-w-[767px] items-center gap-2 border-t bg-white p-2.5">
        <button type="button" className="flex h-11 w-16 flex-col items-center justify-center text-[10px] text-slate-500" onClick={() => setLaptopPage('cart')}>
          <ShoppingCart size={19} />
          购物车
        </button>
        <button disabled={!product.purchasable || product.stock < 1} type="button" className="h-11 flex-1 rounded-full border border-blue-600 font-bold text-blue-600 disabled:opacity-40" onClick={() => addToCart(product, quantity)}>
          加入购物车
        </button>
        <button
          type="button"
          disabled={!product.purchasable || product.stock < 1}
          className="h-11 flex-1 rounded-full bg-blue-600 font-bold text-white disabled:opacity-40"
          onClick={() => {
            addToCart(product, quantity);
            setLaptopPage('cart');
          }}
        >
          立即兑换
        </button>
      </div>
    </div>
  );
}
