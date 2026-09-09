import type { ExperienceAction, ExperienceBlock, ExperiencePage } from '@shop/contract';
import { ArrowRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { ProductCard } from '../../../entity/product';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { responsivePattern } from '../../../shared/view/ResponsivePattern';

export function PublishedPage({ page, viewmodel, afterHero }: Readonly<{ page: ExperiencePage; viewmodel: ReturnType<typeof useHomeViewModel>; afterHero?: ReactNode }>) {
  const heroIndex = page.blocks.findIndex(({ component }) => component === 'hero');
  return (
    <section className="space-y-4" aria-label="商城已发布页面">
      {heroIndex < 0 ? afterHero : null}
      {page.blocks.map((block, index) => (
        <Fragment key={block.id}>
          <PublishedBlock block={block} viewmodel={viewmodel} />
          {index === heroIndex ? afterHero : null}
        </Fragment>
      ))}
    </section>
  );
}

function PublishedBlock({ block, viewmodel }: Readonly<{ block: ExperienceBlock; viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  if (block.component === 'hero') return <Hero block={block} action={(value) => viewmodel.navigateAction(value)} viewmodel={viewmodel} />;
  if (block.component === 'notice')
    return (
      <div role="note" className="rounded-2xl border border-warning bg-warning-surface px-4 py-3 text-sm text-warning-strong">
        {contentText(block.content, 'announcement') ?? contentText(block.content, 'text')}
      </div>
    );
  if (block.component === 'shortcut') return <Shortcuts block={block} action={(value) => viewmodel.navigateAction(value)} />;
  if (block.component === 'productcollection') return <ProductCollection block={block} viewmodel={viewmodel} />;
  return (
    <section className="rounded-3xl border border-edge bg-surface p-5 shadow-sm">
      <h2 className="font-black">{contentText(block.content, 'title') ?? '商城资讯'}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-secondary">{contentText(block.content, 'content') ?? contentText(block.content, 'text')}</p>
    </section>
  );
}

function Hero({ block, action, viewmodel }: Readonly<{ block: ExperienceBlock; action: (value: ExperienceAction) => void; viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  const campaignProduct = viewmodel.presentationProducts.find(({ image }) => image?.trim().length > 0);
  return (
    <section className="relative min-h-44 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand to-brand-dark p-6 text-inverse sm:min-h-56 sm:p-8">
      {campaignProduct ? (
        <ProductMedia
          source={campaignProduct.image}
          alt=""
          className="absolute -bottom-5 -right-5 h-40 w-40 rotate-3 rounded-[2rem] object-cover opacity-90 ring-4 ring-surface/20 sm:bottom-[-2rem] sm:right-5 sm:h-64 sm:w-64"
          emptyClassName="hidden"
        />
      ) : null}
      <div className="relative z-10 max-w-[65%] sm:max-w-[58%]">
        {contentText(block.content, 'eyebrow') ? <p className="text-[11px] font-bold tracking-[.12em] text-inverse-label sm:text-xs">{contentText(block.content, 'eyebrow')}</p> : null}
        <h1 className="mt-2 text-2xl font-black leading-tight sm:text-4xl">{contentText(block.content, 'title')}</h1>
        {contentText(block.content, 'subtitle') ? <p className="mt-3 text-sm font-bold text-inverse-label sm:text-base">{contentText(block.content, 'subtitle')}</p> : null}
        {contentText(block.content, 'description') ? <p className="mt-2 text-xs leading-5 text-inverse-label sm:text-sm sm:leading-6">{contentText(block.content, 'description')}</p> : null}
        {block.action ? (
          <button type="button" onClick={() => action(block.action!)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-4 font-black text-brand-dark hover:bg-brand-faint sm:mt-6">
            立即查看
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Shortcuts({ block, action }: Readonly<{ block: ExperienceBlock; action: (value: ExperienceAction) => void }>) {
  const items = Array.isArray(block.content.items) ? block.content.items.flatMap((value) => shortcut(value)) : [];
  return (
    <section className="rounded-3xl border border-edge bg-surface p-4 shadow-sm">
      <h2 className="font-black">{contentText(block.content, 'title') ?? '快捷入口'}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items
          .filter(({ visible }) => visible !== false)
          .map((item) => (
            <button type="button" key={item.id} onClick={() => action(item.action)} className="min-h-11 rounded-xl bg-subtle px-3 text-sm font-bold hover:bg-brand-light">
              {item.label}
            </button>
          ))}
      </div>
    </section>
  );
}

function ProductCollection({ block, viewmodel }: Readonly<{ block: ExperienceBlock; viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  const ids = new Set([...contentList(block.content, 'listingIds'), ...contentList(block.content, 'productIds')]);
  const limit = Number(block.content.displayLimit) || 4;
  const products = viewmodel.presentationProducts.filter((item) => ids.size === 0 || ids.has(item.listingId) || ids.has(item.productId) || ids.has(item.skuId)).slice(0, limit);
  return (
    <section className="rounded-3xl border border-edge bg-surface p-4 shadow-sm">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">{contentText(block.content, 'title') ?? '精选商品'}</h2>
          {contentText(block.content, 'subtitle') ? <p className="text-xs text-muted">{contentText(block.content, 'subtitle')}</p> : null}
        </div>
        {block.action ? (
          <button type="button" onClick={() => viewmodel.navigateAction(block.action!)} className="text-xs font-bold text-brand">
            查看更多
          </button>
        ) : null}
      </div>
      {products.length ? (
        <div className={responsivePattern.productGrid}>
          {products.map((product) => (
            <ProductCard key={product.listingId} product={product} open={viewmodel.openProduct} add={(item) => viewmodel.addToCart(item, 1)} />
          ))}
        </div>
      ) : (
        <p role="status" className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted">
          当前装修引用的商品暂不可见，请浏览全部商品。
        </p>
      )}
    </section>
  );
}

function contentText(content: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = content[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}
function contentList(content: Readonly<Record<string, unknown>>, key: string): readonly string[] {
  const value = content[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
function shortcut(value: unknown): readonly Readonly<{ id: string; label: string; visible?: boolean; action: ExperienceAction }>[] {
  if (!value || typeof value !== 'object') return [];
  const item = value as Readonly<Record<string, unknown>>;
  const action = item.action as ExperienceAction | undefined;
  return typeof item.id === 'string' && typeof item.label === 'string' && action && typeof action.type === 'string' && typeof action.target === 'string'
    ? [{ id: item.id, label: item.label, ...(typeof item.visible === 'boolean' ? { visible: item.visible } : {}), action }]
    : [];
}
