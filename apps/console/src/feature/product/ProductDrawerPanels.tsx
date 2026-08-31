import type { ProductDetail } from './ProductQuery';
import type { Listing } from './ProductSchema';

export type ProductDrawerTab = 'overview' | 'sku' | 'malls' | 'source' | 'changes';

export function ProductDrawerPanels({ tab, listing, detail, pending, error }: Readonly<{ tab: ProductDrawerTab; listing: Listing; detail: ProductDetail | undefined; pending: boolean; error: Error | null }>) {
  if (pending)
    return (
      <p role="status" className="productdetailstate">
        正在读取商品、SKU、库存与价格权威详情…
      </p>
    );
  if (error !== null)
    return (
      <p role="alert" className="productdetailstate iserror">
        {error.message}
      </p>
    );
  if (detail === undefined)
    return (
      <p role="status" className="productdetailstate">
        暂无商品详情
      </p>
    );
  if (tab === 'overview') return <Overview detail={detail} />;
  if (tab === 'sku') return <SkuPanel detail={detail} />;
  if (tab === 'malls') return <MallPanel detail={detail} />;
  if (tab === 'source') return <SourcePanel detail={detail} listing={listing} />;
  return <ChangePanel detail={detail} listing={listing} />;
}

function Overview({ detail }: Readonly<{ detail: ProductDetail }>) {
  return (
    <section className="productdetailpanel" aria-label="商品概览">
      <h3>商品概览</h3>
      <dl>
        <Entry label="商品编号" value={detail.id} />
        <Entry label="商品名称" value={detail.title} />
        <Entry label="商品类型" value={typeLabel(detail.product_type)} />
        <Entry label="分类编号" value={detail.category_id} />
        <Entry label="品牌编号" value={detail.brand_id ?? '未绑定'} />
        <Entry label="状态" value={detail.status} />
        <Entry label="商品版本" value={`v${detail.version}`} />
        <Entry label="SKU 数" value={String(detail.skus.length)} />
      </dl>
    </section>
  );
}

function SkuPanel({ detail }: Readonly<{ detail: ProductDetail }>) {
  return (
    <section className="productdetailpanel" aria-label="SKU 与库存">
      <h3>SKU 与库存</h3>
      {detail.skus.length === 0 ? (
        <p>该商品尚未建立 SKU。</p>
      ) : (
        detail.skus.map((sku) => (
          <article key={sku.id} className="productdetailcard">
            <header>
              <strong>{sku.code}</strong>
              <span>
                {sku.status} · v{sku.version}
              </span>
            </header>
            <p>{sku.specifications.length === 0 ? '标准规格' : sku.specifications.map((item) => `${item.name}：${item.value}`).join(' · ')}</p>
            <ul>
              {detail.inventory
                .filter((stock) => stock.sku === sku.id)
                .map((stock) => (
                  <li key={`${stock.scope}:${stock.location}`}>
                    <span>
                      {stock.scope} / {stock.location}
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
              {listing.status} · v{listing.version}
            </span>
          </header>
          <p>
            商城：{listing.scope} · 商品池：{listing.pool ?? '未绑定'}
          </p>
          <ul>
            {detail.prices
              .filter((price) => price.sku === listing.sku && price.scope === listing.scope)
              .map((price) => (
                <li key={`${price.scope}:${price.bookVersion}`}>
                  <span>
                    {price.currency} · {price.bookStatus}
                  </span>
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

function SourcePanel({ detail, listing }: Readonly<{ detail: ProductDetail; listing: Listing }>) {
  return (
    <section className="productdetailpanel" aria-label="来源与供货">
      <h3>来源与供货</h3>
      <dl>
        <Entry label="商品所有方" value={detail.owner_partner_id ?? '平台自营'} />
        <Entry label="当前商品池" value={listing.pool_id ?? '未绑定'} />
        <Entry label="当前 SKU" value={listing.sku_id} />
        <Entry label="Listing" value={listing.id} />
      </dl>
      <p className="productboundarynote">供应商合同与供货结算属于合作方域；本页仅展示商品域已授权的所有方引用。</p>
    </section>
  );
}

function ChangePanel({ detail, listing }: Readonly<{ detail: ProductDetail; listing: Listing }>) {
  return (
    <section className="productdetailpanel" aria-label="变更记录">
      <h3>当前版本证据</h3>
      <dl>
        <Entry label="商品版本" value={`v${detail.version}`} />
        <Entry label="列表版本" value={`v${listing.version}`} />
        <Entry label="列表更新时间" value={formatTime(listing.cursor_sort)} />
        <Entry label="生效时间" value={formatTime(listing.effective_at)} />
        <Entry label="失效时间" value={formatTime(listing.expires_at)} />
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

function typeLabel(value: string): string {
  return { physical: '实物商品', virtual: '虚拟商品', service: '服务商品', voucher: '卡券商品' }[value] ?? value;
}
