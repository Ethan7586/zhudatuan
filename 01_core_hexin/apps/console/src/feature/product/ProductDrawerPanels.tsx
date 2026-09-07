import { ProductIcon } from './ProductIcon';
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
  if (preview === undefined) return <UnavailablePanel tab={tab} listing={listing} />;
  if (tab === 'overview') return <Overview preview={preview} listing={listing} onResolve={onResolve} />;
  if (tab === 'sku') return <SkuPanel preview={preview} listing={listing} />;
  if (tab === 'malls') return <MallPanel preview={preview} />;
  if (tab === 'source') return <SourcePanel preview={preview} listing={listing} />;
  return <ChangePanel preview={preview} />;
}

function Overview({
  preview,
  listing,
  onResolve,
}: Readonly<{
  preview: ProductListingPreview;
  listing: Listing;
  onResolve: () => void;
}>) {
  return (
    <div className="productoverview">
      <p className="productpreviewnotice">本地预览：以下聚合信息用于验收布局与交互，不会作为生产商品真值。</p>
      <p className="productconclusion">
        {preview.blocker === null || preview.blocker === undefined ? '商品主档与本地演示链路完整。' : `${preview.mallCount > 0 ? (preview.malls[0]?.name ?? '商城') : '商城'}已上架；${preview.blocker.title}待处理。`}
      </p>
      <div className="productflow" aria-label="商品能力链">
        <FlowStep icon="archive" label="商品主档" value="已完成" tone="success" />
        <FlowStep icon="cube" label="SKU" value={`${preview.skuCount} 个有效`} tone="brand" />
        <FlowStep icon="store" label="商城上架" value={`${preview.mallCount}/${preview.mallTotal}`} tone="violet" />
        <FlowStep icon="price" label="价格" value={preview.priceCents === null ? '未设置' : formatMoney(preview.priceCents)} tone="warning" />
        <FlowStep icon="inventory" label="库存" value={preview.inventory === null ? '未返回' : formatCount(preview.inventory)} tone="brand" />
      </div>
      {preview.blocker === null || preview.blocker === undefined ? null : (
        <section className="productblocker" aria-labelledby="productblockertitle">
          <ProductIcon name="warning" />
          <div>
            <h3 id="productblockertitle">待处理：{preview.blocker.title}</h3>
            <p>{preview.blocker.description}</p>
          </div>
          <button type="button" onClick={onResolve}>
            {preview.blocker.actionLabel}
            <ProductIcon name="arrowRight" />
          </button>
        </section>
      )}
      <dl className="productfacts">
        <div>
          <dt>类目</dt>
          <dd>{preview.categoryName}</dd>
        </div>
        <div>
          <dt>供应商</dt>
          <dd>{preview.supplier.name}</dd>
        </div>
        <div>
          <dt>最近同步</dt>
          <dd>
            {formatTime(preview.lastSyncedAt)} · <span>成功</span>
          </dd>
        </div>
        <div>
          <dt>Operation</dt>
          <dd>
            {preview.operationId} <ProductIcon name="copy" />
          </dd>
        </div>
      </dl>
      <MallStatusTable preview={preview} />
      <p className="productlistingversion">
        当前列表快照：{listing.id} · version {listing.version}
      </p>
    </div>
  );
}

function SkuPanel({ preview, listing }: Readonly<{ preview: ProductListingPreview; listing: Listing }>) {
  return (
    <div className="productdrawersection">
      <p className="productpreviewnotice">本地预览 SKU 与库存展示，不会发起库存写操作。</p>
      <h3>SKU 与库存</h3>
      <dl className="productfacts productfactsvertical">
        <div>
          <dt>SKU 编码</dt>
          <dd>{listing.code ?? listing.sku_id}</dd>
        </div>
        <div>
          <dt>条码</dt>
          <dd>{preview.barcode}</dd>
        </div>
        <div>
          <dt>有效 SKU</dt>
          <dd>
            {preview.skuCount} / {preview.skuTotal}
          </dd>
        </div>
        <div>
          <dt>演示库存</dt>
          <dd>{preview.inventory === null ? '未返回' : `${formatCount(preview.inventory)} 件`}</dd>
        </div>
      </dl>
      <BoundaryNote text="生产库存必须由 inventory Operation 按 Scope 和时点读取，不能从 listing 行推导。" />
    </div>
  );
}

function MallPanel({ preview }: Readonly<{ preview: ProductListingPreview }>) {
  return (
    <div className="productdrawersection">
      <p className="productpreviewnotice">本地预览商城与售价展示。</p>
      <MallStatusTable preview={preview} />
      {preview.blocker === null || preview.blocker === undefined ? null : <BoundaryNote text={`${preview.blocker.title}：${preview.blocker.description}`} warning />}
      <button className="productdrawerdisabledaction" type="button" disabled title="价格操作与 action proof 尚未接入">
        配置商城售价
      </button>
    </div>
  );
}

function SourcePanel({ preview, listing }: Readonly<{ preview: ProductListingPreview; listing: Listing }>) {
  return (
    <div className="productdrawersection">
      <p className="productpreviewnotice">本地预览来源与供货展示。</p>
      <h3>来源与供货</h3>
      <dl className="productfacts productfactsvertical">
        <div>
          <dt>供应商</dt>
          <dd>{preview.supplier.name}</dd>
        </div>
        <div>
          <dt>来源池</dt>
          <dd>{listing.pool_id ?? '未绑定'}</dd>
        </div>
        <div>
          <dt>最近同步</dt>
          <dd>{formatTime(preview.lastSyncedAt)}</dd>
        </div>
        <div>
          <dt>Operation 回执</dt>
          <dd>{preview.operationId}</dd>
        </div>
      </dl>
      <BoundaryNote text="生产来源责任需要单一 Operation 返回；列表池编号本身不等同于完整供货链路。" />
    </div>
  );
}

function ChangePanel({ preview }: Readonly<{ preview: ProductListingPreview }>) {
  return (
    <div className="productdrawersection">
      <p className="productpreviewnotice">本地预览变更记录。</p>
      <h3>变更记录</h3>
      <ol className="productchanges">
        {preview.changes.map((change) => (
          <li key={change.id}>
            <time>{formatTime(change.at)}</time>
            <i aria-hidden="true" />
            <div>
              <strong>{change.title}</strong>
              <span>
                {change.actor} · {change.operationId} · {change.outcome}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <BoundaryNote text="正式审计记录必须由服务端审计读模型返回，并与 Operation 回执关联。" />
    </div>
  );
}

function UnavailablePanel({ tab, listing }: Readonly<{ tab: ProductDrawerTab; listing: Listing }>) {
  const labels: Readonly<Record<ProductDrawerTab, string>> = {
    overview: '商品概览',
    sku: 'SKU 与库存',
    malls: '商城与售价',
    source: '来源与供货',
    changes: '变更记录',
  };
  return (
    <section className="productdetailunavailable" aria-labelledby="productdetailunavailabletitle">
      <ProductIcon name="warning" />
      <h3 id="productdetailunavailabletitle">{labels[tab]}合同待补齐</h3>
      <p>当前只显示列表 Operation 返回的商品快照，不读取本页结果冒充精确详情。</p>
      <dl>
        <div>
          <dt>Listing</dt>
          <dd>{listing.id}</dd>
        </div>
        <div>
          <dt>SKU</dt>
          <dd>{listing.code ?? listing.sku_id}</dd>
        </div>
        <div>
          <dt>管理状态</dt>
          <dd>
            <StatusBadge status={listing.management_status ?? listing.status} />
          </dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>v{listing.version}</dd>
        </div>
      </dl>
      <BoundaryNote text="价格、库存、商城覆盖、供应商与审计记录仍需各自的 Scope-aware 读 Operation。" warning />
    </section>
  );
}

function FlowStep({
  icon,
  label,
  value,
  tone,
}: Readonly<{
  icon: 'archive' | 'cube' | 'store' | 'price' | 'inventory';
  label: string;
  value: string;
  tone: string;
}>) {
  return (
    <div className="productflowstep" data-tone={tone}>
      <i>
        <ProductIcon name={icon} />
      </i>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function MallStatusTable({ preview }: Readonly<{ preview: ProductListingPreview }>) {
  return (
    <section className="productmallstatus" aria-labelledby="mallstatustitle">
      <h3 id="mallstatustitle">商城状态</h3>
      <table>
        <thead>
          <tr>
            <th>商城</th>
            <th>状态</th>
            <th>售价</th>
          </tr>
        </thead>
        <tbody>
          {preview.malls.map((mall) => (
            <tr key={mall.name}>
              <td>{mall.name}</td>
              <td>
                <StatusBadge status={mall.status} />
              </td>
              <td>{mall.priceCents == null ? '未设置' : formatMoney(mall.priceCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function BoundaryNote({ text, warning = false }: Readonly<{ text: string; warning?: boolean }>) {
  return <p className={warning ? 'productboundarynote iswarning' : 'productboundarynote'}>{text}</p>;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100);
}
function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}
function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}
