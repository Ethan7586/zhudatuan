import { ArrowRight, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { formatMinor } from '../../../shared/format/Money';

export function DefaultHome({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  const products = viewmodel.presentationProducts.slice(0, 8);
  return <>
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand to-brand-dark p-6 text-inverse shadow-xl sm:p-8">
      <Sparkles className="absolute -right-10 -top-10 h-48 w-48 opacity-15" />
      <p className="relative text-xs font-bold text-inverse-label">{viewmodel.currentMall.enterpriseName} · 当前员工福利专场</p>
      <h1 className="relative mt-2 max-w-2xl text-2xl font-black leading-tight sm:text-4xl">企业福利，安心选购</h1>
      <p className="relative mt-3 max-w-2xl text-sm leading-6 text-inverse-label">商品、价格、库存、账户资格和履约承诺均由服务端实时校验；结算仅采用有效报价。</p>
      <button type="button" onClick={() => viewmodel.navigatePage('catalog')} className="relative mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-warning px-5 font-black text-content">开始选购<ArrowRight size={17} /></button>
    </section>
    <section className="rounded-3xl border border-edge bg-surface p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-black">员工严选</h2><p className="text-xs text-muted">当前账号可见、可购商品</p></div><button type="button" onClick={() => viewmodel.navigatePage('catalog')} className="text-xs font-bold text-brand">查看全部</button></div>
      {products.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{products.map((product) => (
        <article key={product.id} className="group overflow-hidden rounded-2xl border border-edge bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <button type="button" onClick={() => viewmodel.openProduct(product.id)} className="block w-full text-left"><ProductMedia source={product.image} alt={product.title} className="aspect-square w-full object-cover" emptyClassName="grid aspect-square place-items-center bg-subtle text-xs text-muted" /><div className="p-3"><h3 className="line-clamp-2 min-h-10 text-sm font-bold">{product.title}</h3><span className="mt-2 flex items-center gap-1 text-[10px] text-success-strong"><ShieldCheck size={12} />{product.isEnterpriseExclusive ? '企业专享' : '当前商城已发布'}</span></div></button>
          <div className="flex items-center justify-between px-3 pb-3"><b className="text-danger">¥{formatMinor(product.priceWelfareMinor)}</b><button type="button" disabled={!product.purchasable} onClick={() => viewmodel.addToCart(product, 1)} aria-label={`将${product.title}加入购物车`} className="grid h-10 w-10 place-items-center rounded-full bg-brand text-inverse disabled:bg-disabled"><Plus size={18} /></button></div>
        </article>
      ))}</div> : <div role="status" className="grid min-h-40 place-items-center rounded-2xl border border-dashed text-sm text-muted">{viewmodel.catalogState === 'loading' ? '正在同步商品…' : '当前商城尚未发布商品'}</div>}
    </section>
  </>;
}
