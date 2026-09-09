import { ArrowLeft, Heart, Minus, Plus, Share2, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { chineseDomainList } from '@shop/presentation';
import type { useProductViewModel } from '../viewmodel/ProductViewModel';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { formatMinor } from '../../../shared/format/Money';
import { productAvailability } from '../../../entity/product';

export function ProductPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useProductViewModel> }>) {
  const { product, state, quantity, selectedSkuId, tab, actions } = viewmodel;
  if (state === 'loading')
    return (
      <div role="status" className="grid min-h-[60dvh] place-items-center">
        正在读取商品…
      </div>
    );
  if (state === 'failed')
    return (
      <div role="alert" className="grid min-h-[60dvh] place-items-center text-center">
        <div>
          <h1 className="font-black">商品信息读取失败</h1>
          <p className="mt-2 text-sm text-muted">请检查网络后重试，价格和库存不会使用本地旧值。</p>
          <button type="button" onClick={actions.retry} className="mt-4 min-h-11 whitespace-nowrap rounded-full bg-brand px-5 text-inverse">
            重新读取
          </button>
        </div>
      </div>
    );
  if (!product)
    return (
      <div className="grid min-h-[60dvh] place-items-center text-center">
        <div>
          <h1 className="font-black">商品暂不可查看</h1>
          <button type="button" onClick={actions.back} className="mt-4 min-h-11 whitespace-nowrap rounded-full bg-brand px-5 text-inverse">
            返回商品列表
          </button>
        </div>
      </div>
    );
  const availability = productAvailability(product);
  return (
    <div className="min-h-[80dvh] bg-[var(--sw-background)] px-3 pb-40 pt-3 sm:px-5 md:py-4">
      <div className="mx-auto max-w-[1240px] space-y-4">
        <button type="button" onClick={actions.back} className="flex min-h-11 items-center gap-2 text-sm font-bold text-brand">
          <ArrowLeft size={17} />
          返回商品列表
        </button>
        <section className="grid gap-4 bg-surface md:grid-cols-2 md:gap-6 md:rounded-3xl md:border md:border-edge md:p-6 md:shadow-sm">
          <div className="relative -mx-3 overflow-hidden bg-subtle sm:mx-0 sm:rounded-2xl">
            <ProductMedia source={product.image} alt={product.title} className="aspect-[4/3] h-full w-full object-contain p-4 md:aspect-square md:p-5" emptyClassName="grid aspect-[4/3] place-items-center text-muted md:aspect-square" />
            <span className="absolute left-3 top-3 rounded-full bg-danger px-3 py-1 text-xs font-black text-inverse">商城当前价</span>
          </div>
          <div className="flex flex-col px-1 md:px-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-brand">{product.categoryName}</p>
                <h1 className="mt-1 text-2xl font-black leading-tight">{product.title}</h1>
                <p className="mt-2 text-sm text-muted">{product.subtitle}</p>
              </div>
              <div className="flex">
                <button type="button" onClick={() => viewmodel.toggleFavorite(product.listingId)} aria-label="收藏商品" className="grid h-11 w-11 place-items-center rounded-full border">
                  <Heart size={18} fill={viewmodel.favorites.includes(product.listingId) ? 'currentColor' : 'none'} />
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
                <b className="text-3xl text-danger-strong">{product.saleability.reasons.includes('price_unavailable') ? '暂不可用' : formatMinor(product.priceWelfareMinor)}</b>
                <span className="ml-3 text-xs text-muted line-through">参考价 ¥{formatMinor(product.priceMarketMinor)}</span>
              </div>
              <p className="mt-2 text-xs text-muted">结算金额以服务端有效报价为准</p>
            </div>
            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              <span className="flex min-h-11 items-center gap-2 rounded-xl bg-success-surface px-3 text-success-strong">
                <ShieldCheck size={16} />
                {product.qualification.eligible === true ? '经营资格已核验' : '经营资格等待恢复'} · 可用账户：{product.allowedAccounts.length ? chineseDomainList(product.allowedAccounts) : '结算时确认'}
              </span>
              <span className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-light px-3 text-brand-dark">
                <Truck size={16} />
                {product.deliverySla || '履约承诺以订单为准'}
              </span>
            </div>
            {product.skus.length ? (
              <div className="mt-4">
                <b className="text-sm">选择规格</b>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.skus.map((sku, index) => (
                    <button
                      type="button"
                      key={sku.id}
                      onClick={() => actions.selectSku(sku.id)}
                      className={`min-h-11 rounded-xl border px-3 text-left text-xs ${selectedSkuId === sku.id ? 'border-brand bg-brand-light font-bold text-brand' : ''}`}
                    >
                      <span className="block">{skuName(sku.specifications, index)}</span>
                      <span className="mt-0.5 block text-[10px] text-muted">
                        ¥{formatMinor(sku.priceMinor)} · {sku.saleability.state === 'saleable' ? `可售 ${sku.available} 件` : productAvailability({ saleability: sku.saleability, stock: sku.available }).actionButtonStateText}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {!availability.canPurchase ? (
              <div role="status" className="mt-4 rounded-xl border border-warning bg-warning-surface p-3 text-xs font-bold text-warning-strong">
                {availability.availabilityText}
                <p className="mt-1 font-normal">可切换其他规格，或稍后刷新商品信息。</p>
              </div>
            ) : null}
            <div className="mt-auto pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-bold">{availability.availabilityText}</span>
                <div className="flex overflow-hidden rounded-xl border">
                  <button type="button" disabled={quantity <= 1} onClick={() => actions.changeQuantity(quantity - 1)} aria-label={`减少${product.title}数量`} className="grid h-11 w-11 place-items-center disabled:opacity-40">
                    <Minus size={15} />
                  </button>
                  <span className="grid min-w-12 place-items-center border-x font-bold">{quantity}</span>
                  <button
                    type="button"
                    disabled={!availability.canPurchase || quantity >= product.stock}
                    onClick={() => actions.changeQuantity(quantity + 1)}
                    aria-label={`增加${product.title}数量`}
                    className="grid h-11 w-11 place-items-center disabled:opacity-40"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              <div
                data-product-actions
                className="fixed inset-x-0 bottom-[68px] z-20 grid grid-cols-2 gap-2 border-t border-edge bg-surface/95 px-3 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:static md:mx-0 md:gap-3 md:border-0 md:bg-transparent md:p-0 md:shadow-none"
              >
                <button type="button" disabled={!availability.canPurchase} onClick={actions.add} className="min-h-12 whitespace-nowrap rounded-2xl border border-brand font-black text-brand disabled:opacity-40">
                  <ShoppingCart size={18} className="mr-2 inline" />
                  加入购物车
                </button>
                <button type="button" disabled={!availability.canPurchase} onClick={actions.buy} className="min-h-12 whitespace-nowrap rounded-2xl bg-brand font-black text-inverse disabled:bg-disabled">
                  立即购买
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="rounded-3xl border border-edge bg-surface p-4 md:p-5">
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

function skuName(specifications: Readonly<Record<string, string>>, index: number): string {
  const values = Object.entries(specifications).map(([name, value]) => `${name}：${value}`);
  return values.length ? values.join(' · ') : `规格 ${index + 1}`;
}
