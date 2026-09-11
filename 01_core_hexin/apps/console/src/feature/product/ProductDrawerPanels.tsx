import type { ReactNode } from 'react';
import { ProductIcon, type ProductIconName } from './ProductIcon';
import type { Listing, ProductListingPreview } from './ProductSchema';
import { StatusBadge } from './ProductTable';

export type ProductDrawerTab = 'overview' | 'sku' | 'malls' | 'source' | 'changes';

interface ProductDrawerPanelsProps {
  readonly tab: ProductDrawerTab;
  readonly listing: Listing;
  readonly preview?: ProductListingPreview;
  readonly onResolve: () => void;
}

export function ProductDrawerPanels({ tab, listing, preview, onResolve }: ProductDrawerPanelsProps) {
  if (tab === 'overview') return <Overview listing={listing} {...(preview === undefined ? {} : { preview })} onResolve={onResolve} />;
  if (tab === 'sku') return <SkuPanel listing={listing} {...(preview === undefined ? {} : { preview })} />;
  if (tab === 'malls') return <MallPanel {...(preview === undefined ? {} : { preview })} />;
  if (tab === 'source') return <SourcePanel listing={listing} {...(preview === undefined ? {} : { preview })} />;
  return <ChangePanel listing={listing} {...(preview === undefined ? {} : { preview })} />;
}

function Overview({ listing, preview, onResolve }: Readonly<{
  listing: Listing;
  preview?: ProductListingPreview;
  onResolve: () => void;
}>) {
  const status = listing.management_status ?? listing.status;
  return (
    <div className="productoverview">
      <ProductLifecycle status={status} {...(listing.effective_at === undefined ? {} : { publishedAt: listing.effective_at })} />
      <section className="productsummary" aria-label="商品核心信息">
        <SummaryMetric label="SKU" value={formatCount(preview?.skuCount ?? listing.sku_count)} icon="cube" />
        <SummaryMetric label={preview === undefined ? '商品类型' : '可售库存'}
          value={preview === undefined ? productType(listing.product_type) : formatCount(preview.inventory)} icon="inventory" />
        <SummaryMetric label={preview === undefined ? '管理状态' : '售价'}
          value={preview === undefined ? statusLabel(status) : formatMoney(preview.priceCents)} icon="price" />
        <SummaryMetric label={preview === undefined ? '数据版本' : '覆盖商城'}
          value={preview === undefined ? `v${listing.version}` : formatCount(preview.mallCount)} icon="store" />
      </section>
      <div className="productoverviewgrid">
        <InfoGroup title="商品信息" icon="inventory">
          <InfoRow label="商品名称" value={listing.title} />
          <InfoRow label="商品编号" value={listing.code ?? listing.sku_id} />
          <InfoRow label="商品类型" value={productType(listing.product_type)} />
          <InfoRow label="生效时间" value={formatDateTime(listing.effective_at)} />
          <InfoRow label="失效时间" value={formatDateTime(listing.expires_at)} />
        </InfoGroup>
        <InfoGroup title="供应关系" icon="store">
          <InfoRow label="供应商" value={preview?.supplier.name ?? '待同步'} />
          <InfoRow label="来源池" value={listing.pool_id ?? '未绑定'} />
          <InfoRow label="供应状态" value={preview === undefined ? '待同步' : '正常供货'} />
          <InfoRow label="最近同步" value={preview === undefined ? '—' : formatDateTime(preview.lastSyncedAt)} />
        </InfoGroup>
      </div>
      {preview?.blocker === null || preview?.blocker === undefined ? null : (
        <section className="productblocker" aria-labelledby="productblockertitle">
          <ProductIcon name="warning" />
          <div><h3 id="productblockertitle">{preview.blocker.title}</h3><p>{preview.blocker.description}</p></div>
          <button type="button" onClick={onResolve}>{preview.blocker.actionLabel}<ProductIcon name="arrowRight" /></button>
        </section>
      )}
      {preview === undefined ? <DataAvailability /> : <MallStatusTable preview={preview} />}
    </div>
  );
}

function ProductLifecycle({ status, publishedAt }: Readonly<{ status: string; publishedAt?: string | null }>) {
  const active = lifecycleIndex(status);
  const steps = Object.freeze(['建档', '补全', '审核', '上架', '变更']);
  return (
    <section className="productlifecycle" aria-labelledby="productlifecycletitle">
      <h3 id="productlifecycletitle">商品生命周期</h3>
      <ol>
        {steps.map((label, index) => {
          const state = index < active ? 'complete' : index === active ? 'current' : 'waiting';
          return <li key={label} data-state={state}>
            <i>{state === 'complete' ? '✓' : index + 1}</i>
            <strong>{label}</strong>
            <time>{label === '上架' && status === 'published' ? formatDateTime(publishedAt) : '—'}</time>
            <span>{state === 'complete' ? '已完成' : state === 'current' ? '当前' : '等待'}</span>
          </li>;
        })}
      </ol>
    </section>
  );
}

function SummaryMetric({ label, value, icon }: Readonly<{
  label: string;
  value: string;
  icon: 'cube' | 'inventory' | 'price' | 'store';
}>) {
  return <div className="productsummarymetric"><span>{label}</span><strong>{value}</strong><i><ProductIcon name={icon} /></i></div>;
}

function InfoGroup({ title, icon, children }: Readonly<{ title: string; icon?: ProductIconName; children: ReactNode }>) {
  return <section className="productinfogroup"><h3>{icon === undefined ? null : <i aria-hidden="true"><ProductIcon name={icon} /></i>}{title}</h3><dl>{children}</dl></section>;
}

function InfoRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}

function SkuPanel({ listing, preview }: Readonly<{ listing: Listing; preview?: ProductListingPreview }>) {
  return (
    <section className="productdrawersection">
      <SectionHeading title="SKU与库存" hint={preview === undefined ? '库存数据尚未同步' : `${preview.skuCount} 个有效 SKU`} />
      <div className="productdetailtablewrap">
        <table className="productdetailtable">
          <thead><tr><th>SKU</th><th>商品编号</th><th>SKU数量</th><th>库存</th><th>状态</th></tr></thead>
          <tbody><tr><td>{listing.sku_id}</td><td>{listing.code ?? '—'}</td><td>{formatCount(preview?.skuCount ?? listing.sku_count)}</td>
            <td>{preview === undefined ? '待同步' : formatCount(preview.inventory)}</td><td><StatusBadge status={listing.management_status ?? listing.status} /></td></tr></tbody>
        </table>
      </div>
      {preview === undefined ? <CompactEmpty icon="inventory" title="库存尚未同步" description="当前商品记录只包含SKU数量，库存将在数据接入后显示。" /> : null}
    </section>
  );
}

function MallPanel({ preview }: Readonly<{ preview?: ProductListingPreview }>) {
  if (preview === undefined) return <CompactEmpty icon="store" title="商城售价尚未同步" description="当前商品记录尚未包含商城覆盖与售价信息。" />;
  return <section className="productdrawersection"><SectionHeading title="商城与售价" hint={`${preview.mallCount}/${preview.mallTotal} 个商城`} />
    <MallStatusTable preview={preview} /></section>;
}

function SourcePanel({ preview, listing }: Readonly<{ preview?: ProductListingPreview; listing: Listing }>) {
  return <section className="productdrawersection">
    <SectionHeading title="来源与供货" hint={preview === undefined ? '供应关系待同步' : '供应关系正常'} />
    <div className="productoverviewgrid">
      <InfoGroup title="来源信息" icon="archive"><InfoRow label="来源池" value={listing.pool_id ?? '未绑定'} />
        <InfoRow label="商品类型" value={productType(listing.product_type)} /><InfoRow label="商品版本" value={`v${listing.version}`} /></InfoGroup>
      <InfoGroup title="供货信息" icon="store"><InfoRow label="供应商" value={preview?.supplier.name ?? '待同步'} />
        <InfoRow label="供应状态" value={preview === undefined ? '待同步' : '正常供货'} />
        <InfoRow label="最近同步" value={preview === undefined ? '—' : formatDateTime(preview.lastSyncedAt)} /></InfoGroup>
    </div>
    {preview === undefined ? <CompactEmpty icon="archive" title="供应关系尚未同步" description="来源池和供应商将在对应数据返回后自动补充。" /> : null}
  </section>;
}

function ChangePanel({ preview, listing }: Readonly<{ preview?: ProductListingPreview; listing: Listing }>) {
  const changes = preview?.changes ?? [];
  if (changes.length === 0 && listing.cursor_sort === undefined) {
    return <CompactEmpty icon="archive" title="暂无变更记录" description="当前没有可展示的商品变更记录。" />;
  }
  return <section className="productdrawersection"><SectionHeading title="变更记录" hint="按时间倒序" />
    <ol className="productchanges">
      {changes.length > 0 ? changes.map((change) => <li key={change.id}><time>{formatDateTime(change.at)}</time><i aria-hidden="true" />
        <div><strong>{change.title}</strong><span>{change.actor} · {change.outcome}</span></div></li>)
        : <li><time>{formatDateTime(listing.cursor_sort)}</time><i aria-hidden="true" /><div><strong>商品记录更新</strong><span>当前列表返回的最近更新时间</span></div></li>}
    </ol></section>;
}

function SectionHeading({ title, hint }: Readonly<{ title: string; hint: string }>) {
  return <header className="productsectionheading"><h3>{title}</h3><span>{hint}</span></header>;
}

function CompactEmpty({ icon, title, description }: Readonly<{
  icon: 'archive' | 'inventory' | 'store';
  title: string;
  description: string;
}>) {
  return <section className="productcompactempty"><i><ProductIcon name={icon} /></i><div><h3>{title}</h3><p>{description}</p></div></section>;
}

function DataAvailability() {
  return <section className="productavailability" aria-labelledby="productavailabilitytitle"><h3 id="productavailabilitytitle">数据完整度</h3>
    <ul><li><span>商品主档</span><strong data-ready="true">已返回</strong></li><li><span>SKU数量</span><strong data-ready="true">已返回</strong></li>
      <li><span>库存与售价</span><strong>待同步</strong></li><li><span>商城与供应关系</span><strong>待同步</strong></li></ul></section>;
}

function MallStatusTable({ preview }: Readonly<{ preview: ProductListingPreview }>) {
  return <section className="productmallstatus" aria-labelledby="mallstatustitle"><h3 id="mallstatustitle">商城售价</h3><table><thead><tr><th>商城</th><th>状态</th><th>售价</th></tr></thead>
    <tbody>{preview.malls.map((mall) => <tr key={mall.id}><td>{mall.name}</td><td><StatusBadge status={mall.status} /></td>
      <td>{formatMoney(mall.priceCents)}</td></tr>)}</tbody></table></section>;
}

function lifecycleIndex(status: string): number {
  if (status === 'needs_attention') return 1;
  if (status === 'pending_review') return 2;
  if (status === 'published') return 3;
  if (status === 'unpublished') return 4;
  return 0;
}

function statusLabel(status: string): string {
  if (status === 'needs_attention') return '待完善';
  if (status === 'pending_review') return '待审核';
  if (status === 'published') return '已上架';
  if (status === 'unpublished') return '已下架';
  return status;
}

function productType(value: string | null | undefined): string {
  if (value === 'physical' || value === 'goods') return '实物商品';
  if (value === 'service') return '服务商品';
  return value == null || value === '' ? '待补充' : value;
}

function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '待同步';
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100);
}

function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '待同步';
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}
