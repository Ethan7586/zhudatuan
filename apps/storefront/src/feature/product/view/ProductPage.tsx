import { ArrowLeft, Heart, Minus, Plus, Share2, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { chineseDomainList } from '@shop/presentation';
import type { useProductViewModel } from '../viewmodel/ProductViewModel';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { formatMinor } from '../../../shared/format/Money';
import { inventoryStatus } from '../../../entity/product';

export function ProductPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useProductViewModel> }>) {
  const { product, state, quantity, selectedSpec, tab, actions } = viewmodel;
  if (state === 'loading')
    return (
      <div role="status" className="grid min-h-[60dvh] place-items-center">
        正在读取商品…
      </div>
    );
  if (!product)
    return (
      <div className="grid min-h-[60dvh] place-items-center text-center">
        <div>
          <h1 className="font-black">商品暂不可查看</h1>
          <button type="button" onClick={actions.back} className="mt-4 rounded-full bg-brand px-5 py-2 text-inverse">
            返回商品列表
          </button>
        </div>
      </div>
    );
  const inventory = inventoryStatus(product.stock);
  const options = product.specs?.flatMap(({ name, options }) => options.map((option) => `${name}：${option}`)) ?? [];
  return (
    <div className="min-h-[80dvh] bg-[var(--sw-background)] px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-[1240px] space-y-4">
        <button type="button" onClick={actions.back} className="flex min-h-11 items-center gap-2 text-sm font-bold text-brand">
          <ArrowLeft size={17} />
          返回商品列表
        </button>
        <section className="grid gap-6 rounded-3xl border border-edge bg-surface p-4 shadow-sm md:grid-cols-2 md:p-6">
          <div className="relative overflow-hidden rounded-2xl bg-subtle">
            <ProductMedia source={product.image} alt={product.title} className="aspect-square h-full w-full object-contain p-5" emptyClassName="grid aspect-square place-items-center text-muted" />
            <span className="absolute left-3 top-3 rounded-full bg-danger px-3 py-1 text-xs font-black text-inverse">商城当前价</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-brand">{product.categoryName}</p>
                <h1 className="mt-1 text-2xl font-black leading-tight">{product.title}</h1>
                <p className="mt-2 text-sm text-muted">{product.subtitle}</p>
              </div>
              <div className="flex">
                <button type="button" onClick={() => viewmodel.toggleFavorite(product.id)} aria-label="收藏商品" className="grid h-11 w-11 place-items-center rounded-full border">
                  <Heart size={18} fill={viewmodel.favorites.includes(product.id) ? 'currentColor' : 'none'} />
                </button>
                <button type="button" onClick={() => void viewmodel.shareProduct(product)} aria-label="分享商品" className="ml-2 grid h-11 w-11 place-items-center rounded-full border">
                  <Share2 size={18} />
                </button>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-danger-surface p-4">
              <span className="text-xs text-danger-strong">福利价</span>
              <div>
                <span className="text-sm font-bold text-danger-strong">¥</span>
                <b className="text-3xl text-danger-strong">{formatMinor(product.priceWelfareMinor)}</b>
                <span className="ml-3 text-xs text-muted line-through">参考价 ¥{formatMinor(product.priceMarketMinor)}</span>
              </div>
              <p className="mt-2 text-xs text-muted">结算金额以服务端有效报价为准</p>
            </div>
            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              <span className="flex min-h-11 items-center gap-2 rounded-xl bg-success-surface px-3 text-success-strong">
                <ShieldCheck size={16} />
                可用账户：{product.allowedAccounts.length ? chineseDomainList(product.allowedAccounts) : '报价时确认'}
              </span>
              <span className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-light px-3 text-brand-dark">
                <Truck size={16} />
                {product.deliverySla || '履约承诺以订单为准'}
              </span>
            </div>
            {options.length ? (
              <div className="mt-4">
                <b className="text-sm">选择规格</b>
                <div className="mt-2 flex flex-wrap gap-2">
                  {options.map((option) => (
                    <button type="button" key={option} onClick={() => actions.selectSpec(option)} className={`min-h-11 rounded-xl border px-3 text-xs ${selectedSpec === option ? 'border-brand bg-brand-light font-bold text-brand' : ''}`}>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-auto pt-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold">{inventory.availabilityText}</span>
                <div className="flex overflow-hidden rounded-xl border">
                  <button type="button" onClick={() => actions.changeQuantity(quantity - 1)} aria-label={`减少${product.title}数量`} className="grid h-11 w-11 place-items-center">
                    <Minus size={15} />
                  </button>
                  <span className="grid min-w-12 place-items-center border-x font-bold">{quantity}</span>
                  <button type="button" onClick={() => actions.changeQuantity(quantity + 1)} aria-label={`增加${product.title}数量`} className="grid h-11 w-11 place-items-center">
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={!inventory.canPurchase} onClick={actions.add} className="min-h-12 rounded-2xl border border-brand font-black text-brand disabled:opacity-40">
                  <ShoppingCart size={18} className="mr-2 inline" />
                  加入购物车
                </button>
                <button type="button" disabled={!inventory.canPurchase} onClick={actions.buy} className="min-h-12 rounded-2xl bg-brand font-black text-inverse disabled:bg-disabled">
                  立即购买
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="rounded-3xl border border-edge bg-surface p-5">
          <div className="flex border-b">
            {(['detail', 'spec', 'aftersale'] as const).map((value) => (
              <button type="button" key={value} onClick={() => actions.selectTab(value)} className={`min-h-11 flex-1 border-b-2 text-sm font-bold ${tab === value ? 'border-brand text-brand' : 'border-transparent text-muted'}`}>
                {value === 'detail' ? '商品详情' : value === 'spec' ? '规格参数' : '售后与发票'}
              </button>
            ))}
          </div>
          <div className="min-h-40 py-5 text-sm leading-7 text-secondary">
            {tab === 'detail'
              ? product.description || '商品详情以当前发布版本为准。'
              : tab === 'spec'
                ? (product.params?.map(({ key, value }) => (
                    <p key={key}>
                      <b>{key}：</b>
                      {value}
                    </p>
                  )) ?? '暂无更多参数')
                : '售后资格、退货地址、退款拆分和发票状态以订单权威读模型为准。'}
          </div>
        </section>
      </div>
    </div>
  );
}
