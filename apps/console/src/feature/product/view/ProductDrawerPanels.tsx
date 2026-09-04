import { chineseDomainLabel, chineseReference, presentProductStatus, presentProductType } from '@shop/presentation';
import { ResourceState, SectionBoundary } from '@shop/design';
import type { Listing, ProductDetail } from '../model/Product';
import { isManagedListing } from '../model/ProductAction';
import type { ProductDetailSectionViewModel, ProductDetailViewModel } from '../viewmodel/ProductDetailViewModel';

export type ProductDrawerTab = 'overview' | 'sku' | 'malls' | 'source' | 'changes';

export function ProductDrawerPanels({
  tab,
  listing,
  detail,
  sections,
  onPool,
  canPool,
}: Readonly<{ tab: ProductDrawerTab; listing: Listing; detail: ProductDetail | undefined; sections: ProductDetailViewModel['sections']; onPool: (listing: Listing) => void; canPool: boolean }>) {
  const models = panelModels(tab, sections);
  const model = models.reduce((current, candidate) => (priority(candidate.condition) > priority(current.condition) ? candidate : current));
  const retryable = models.filter((section) => priority(section.condition) > 0);
  const retry = () => (retryable.length === 0 ? models : retryable).forEach((section) => section.refresh());
  return (
    <div className="productdrawerresource">
      <SectionBoundary title={`${tabLabel(tab)}暂时无法显示`} resetKey={`${tab}:${model.condition}`}>
        <ResourceState condition={model.condition} {...(model.error === undefined ? {} : { error: model.error })} retry={retry}>
          {detail === undefined ? <p>暂无商品详情</p> : <Panel tab={tab} listing={listing} detail={detail} onPool={onPool} canPool={canPool} />}
        </ResourceState>
      </SectionBoundary>
    </div>
  );
}

function Panel({ tab, listing, detail, onPool, canPool }: Readonly<{ tab: ProductDrawerTab; listing: Listing; detail: ProductDetail; onPool: (listing: Listing) => void; canPool: boolean }>) {
  if (tab === 'overview') return <Overview detail={detail} />;
  if (tab === 'sku') return <SkuPanel detail={detail} />;
  if (tab === 'malls') return <MallPanel detail={detail} />;
  if (tab === 'source') return <SourcePanel detail={detail} listing={listing} onPool={onPool} canPool={canPool} />;
  return <ChangePanel detail={detail} listing={listing} />;
}

function panelModels(tab: ProductDrawerTab, sections: ProductDetailViewModel['sections']): readonly ProductDetailSectionViewModel[] {
  if (tab === 'sku') return [sections.core, sections.inventory];
  if (tab === 'malls') return [sections.core, sections.pricing];
  return [sections.core];
}

function priority(condition: ProductDetailSectionViewModel['condition']): number {
  if (condition === 'ready' || condition === 'empty') return 0;
  if (condition === 'refreshing' || condition === 'retry') return 1;
  if (condition === 'stale') return 2;
  if (condition === 'loading') return 3;
  return 4;
}

function tabLabel(tab: ProductDrawerTab): string {
  return { overview: '商品概览', sku: '规格与库存', malls: '商城与售价', source: '来源与供货', changes: '变更记录' }[tab];
}

function Overview({ detail }: Readonly<{ detail: ProductDetail }>) {
  return (
    <section className="productdetailpanel" aria-label="商品概览">
      <h3>商品概览</h3>
      <dl>
        <Entry label="商品编号" value={chineseReference('商品', detail.id)} />
        <Entry label="商品名称" value={detail.title} />
        <Entry label="商品类型" value={presentProductType(detail.product_type)} />
        <Entry label="分类" value={chineseReference('分类', detail.category_id)} />
        <Entry label="品牌" value={detail.brand_id ? chineseReference('品牌', detail.brand_id) : '未绑定'} />
        <Entry label="状态" value={presentProductStatus(detail.status).label} />
        <Entry label="商品版本" value={`第 ${detail.version} 版`} />
        <Entry label="规格数" value={String(detail.skus.length)} />
      </dl>
    </section>
  );
}

function SkuPanel({ detail }: Readonly<{ detail: ProductDetail }>) {
  return (
    <section className="productdetailpanel" aria-label="商品规格与库存">
      <h3>商品规格与库存</h3>
      {detail.skus.length === 0 ? (
        <p>该商品尚未建立规格。</p>
      ) : (
        detail.skus.map((sku) => (
          <article key={sku.id} className="productdetailcard">
            <header>
              <strong>{sku.code}</strong>
              <span>
                {chineseDomainLabel(sku.status)} · 第 {sku.version} 版
              </span>
            </header>
            <p>{sku.specifications.length === 0 ? '标准规格' : sku.specifications.map((item) => `${item.name}：${item.value}`).join(' · ')}</p>
            <ul>
              {detail.inventory
                .filter((stock) => stock.sku === sku.id)
                .map((stock) => (
                  <li key={`${stock.scope}:${stock.location}`}>
                    <span>
                      {chineseReference('库存范围', stock.scope)} · {chineseReference('库位', stock.location)}
                    </span>
                    <strong>
                      可用基数 {stock.onhand} · 安全库存 {stock.safety}
                    </strong>
                  </li>
                ))}
            </ul>
          </article>
        ))
      )}
    </section>
  );
}

function MallPanel({ detail }: Readonly<{ detail: ProductDetail }>) {
  return (
    <section className="productdetailpanel" aria-label="商城与售价">
      <h3>商城与售价</h3>
      {detail.listings.map((listing) => (
        <article key={listing.id} className="productdetailcard">
          <header>
            <strong>{listing.title}</strong>
            <span>
              {chineseDomainLabel(listing.status)} · 第 {listing.version} 版
            </span>
          </header>
          <p>
            商城：{chineseReference('商城', listing.scope)} · 商品池：{listing.pool ? chineseReference('商品池', listing.pool) : '未绑定'}
          </p>
          <ul>
            {detail.prices
              .filter((price) => price.sku === listing.sku && price.scope === listing.scope)
              .map((price) => (
                <li key={`${price.scope}:${price.bookVersion}`}>
                  <span>人民币 · {chineseDomainLabel(price.bookStatus)}</span>
                  <strong>{money(price.amountMinor, price.currency)}</strong>
                </li>
              ))}
          </ul>
        </article>
      ))}
      {detail.listings.length === 0 ? <p>当前可见范围没有商城投放记录。</p> : null}
    </section>
  );
}

function SourcePanel({ detail, listing, onPool, canPool }: Readonly<{ detail: ProductDetail; listing: Listing; onPool: (listing: Listing) => void; canPool: boolean }>) {
  const managed = isManagedListing(listing);
  const manageable = canPool && managed && listing.status !== 'published' && listing.status !== 'retired';
  return (
    <section className="productdetailpanel" aria-label="来源与供货">
      <h3>来源与供货</h3>
      <dl>
        <Entry label="商品所有方" value={detail.owner_partner_id ? chineseReference('合作方', detail.owner_partner_id) : '平台自营'} />
        <Entry label="当前商品池" value={managed && listing.pool_id ? chineseReference('商品池', listing.pool_id) : '未绑定'} />
        <Entry label="当前商品规格" value={chineseReference('规格', listing.sku_id)} />
        <Entry label="商城上架记录" value={chineseReference('上架记录', listing.id)} />
      </dl>
      <p className="productboundarynote">供应信息由供应商管理统一维护，本页展示当前商品的归属与投放关系。</p>
      <button
        className="productpanelaction"
        type="button"
        disabled={!manageable}
        title={
          manageable
            ? undefined
            : !canPool
              ? '当前账号没有调整商品投池关系的权限。'
              : !managed
                ? '渠道商品尚未映射，不能调整商品池'
                : listing.status === 'published'
                  ? '请先下架商品再调整商品池'
                  : '已归档商品不能调整商品池'
        }
        onClick={() => onPool(listing)}
      >
        管理商品投池
      </button>
    </section>
  );
}

function ChangePanel({ detail, listing }: Readonly<{ detail: ProductDetail; listing: Listing }>) {
  const managed = isManagedListing(listing);
  return (
    <section className="productdetailpanel" aria-label="变更记录">
      <h3>当前版本证据</h3>
      <dl>
        <Entry label="商品版本" value={`第 ${detail.version} 版`} />
        <Entry label="列表版本" value={`第 ${listing.version} 版`} />
        <Entry label="列表更新时间" value={formatTime(listing.cursor_sort)} />
        <Entry label="生效时间" value={formatTime(managed ? listing.effective_at : null)} />
        <Entry label="失效时间" value={formatTime(managed ? listing.expires_at : null)} />
      </dl>
      <p className="productboundarynote">所有写操作均携带当前版本；版本变化时服务端拒绝旧快照，避免覆盖并发修改。</p>
    </section>
  );
}

function Entry({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function money(value: string | number, currency: string): string {
  const amount = Number(value) / 100;
  return Number.isFinite(amount) ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(amount) : `${currency} ${value}`;
}

function formatTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(time);
}
