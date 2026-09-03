import { chineseDomainLabel, chineseReference, chineseSectionLabel } from '@shop/presentation';
import { Button, ResourcePanel } from '@shop/design';

import { DataTable, MetricGrid, type DataColumn } from '@shop/design';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { ProductDetail } from '../model/Product';
import type { ProductDetailViewModel } from '../viewmodel/ProductDetailViewModel';

type Sku = ProductDetail['skus'][number];
type Listing = ProductDetail['listings'][number];
type Stock = ProductDetail['inventory'][number];
type Price = ProductDetail['prices'][number];

const skuColumns: readonly DataColumn<Sku>[] = Object.freeze([
  { key: 'code', label: '商品规格编码', render: (row) => chineseReference('规格', row.code) },
  { key: 'specifications', label: '规格', render: (row) => row.specifications.map((item) => `${item.name}：${item.value}`).join(' · ') || '—' },
  { key: 'status', label: '状态', render: (row) => chineseDomainLabel(row.status) },
  { key: 'version', label: '版本', render: (row) => `第 ${formatInteger(row.version)} 版` },
]);

const listingColumns: readonly DataColumn<Listing>[] = Object.freeze([
  { key: 'title', label: '商城标题', render: (row) => row.title },
  { key: 'scope', label: '商城范围', render: (row) => chineseReference('商城', row.scope) },
  { key: 'pool', label: '来源池', render: (row) => (row.pool ? chineseReference('商品池', row.pool) : '未绑定') },
  { key: 'sku', label: '商品规格', render: (row) => chineseReference('规格', row.sku) },
  { key: 'status', label: '上架状态', render: (row) => chineseDomainLabel(row.status) },
  { key: 'effective', label: '生效时间', render: (row) => formatDate(row.effectiveAt) },
  { key: 'expires', label: '失效时间', render: (row) => formatDate(row.expiresAt) },
]);

const stockColumns: readonly DataColumn<Stock>[] = Object.freeze([
  { key: 'sku', label: '商品规格', render: (row) => chineseReference('规格', row.sku) },
  { key: 'scope', label: '库存范围', render: (row) => chineseReference('库存范围', row.scope) },
  { key: 'location', label: '库位', render: (row) => chineseReference('库位', row.location) },
  { key: 'onhand', label: '在手库存', render: (row) => formatInteger(row.onhand) },
  { key: 'safety', label: '安全库存', render: (row) => formatInteger(row.safety) },
  { key: 'status', label: '状态', render: (row) => chineseDomainLabel(row.status) },
]);

const priceColumns: readonly DataColumn<Price>[] = Object.freeze([
  { key: 'sku', label: '商品规格', render: (row) => chineseReference('规格', row.sku) },
  { key: 'scope', label: '价格范围', render: (row) => chineseReference('价格范围', row.scope) },
  { key: 'price', label: '当前售价', render: (row) => formatDatabaseMinor(row.amountMinor, row.currency) },
  { key: 'compare', label: '划线价', render: (row) => (row.compareMinor === null ? '—' : formatDatabaseMinor(row.compareMinor, row.currency)) },
  { key: 'status', label: '价格簿状态', render: (row) => chineseDomainLabel(row.bookStatus) },
  { key: 'effective', label: '生效时间', render: (row) => formatDate(row.effectiveAt) },
  { key: 'expires', label: '失效时间', render: (row) => formatDate(row.expiresAt) },
]);

export function ProductDetailPage({ routeTitle, viewmodel }: Readonly<{ routeTitle: string; viewmodel: ProductDetailViewModel }>) {
  const data = viewmodel.data;
  return (
    <ResourcePanel
      title={routeTitle}
      eyebrow={chineseSectionLabel('商品详情')}
      description={data === undefined ? '正在读取商品的服务端详情。' : `${data.title} · ${data.subtitle ?? '服务端商品主档'} · ${chineseReference('商品', data.id)}`}
      condition={viewmodel.condition}
      {...(viewmodel.error === undefined ? {} : { error: viewmodel.error })}
      retry={viewmodel.refresh}
      actions={<Button onPress={viewmodel.refresh}>刷新</Button>}
    >
      {data === undefined ? <span /> : <ProductDetailContent data={data} />}
    </ResourcePanel>
  );
}

function ProductDetailContent({ data }: Readonly<{ data: ProductDetail }>) {
  return (
    <div className="featurestack">
      <MetricGrid
        items={[
          { label: '商品状态', value: chineseDomainLabel(data.status), detail: chineseDomainLabel(data.product_type) },
          { label: '商品规格', value: formatInteger(data.skus.length), detail: '商品主档投影' },
          { label: '商城上架', value: formatInteger(data.listings.length), detail: '当前范围可见' },
          { label: '库存记录', value: formatInteger(data.inventory.length), detail: '当前范围可见' },
          { label: '价格记录', value: formatInteger(data.prices.length), detail: '当前范围可见' },
          { label: '主档版本', value: `第 ${formatInteger(data.version)} 版`, detail: chineseReference('分类', data.category_id) },
        ]}
      />
      <section className="capabilitynote" aria-labelledby="productdetailscope">
        <h2 id="productdetailscope">范围与来源责任</h2>
        <p>商品主档来自商品中心；商品规格、商城上架、库存与价格由服务端按当前授权范围聚合，只呈现接口协议允许的字段。</p>
      </section>
      <DetailTable id="productskus" title="商品规格" caption="商品规格与属性" rows={data.skus} columns={skuColumns} rowKey={(row) => row.id} />
      <DetailTable id="productlistings" title="商城与来源池" caption="商品商城上架与来源池" rows={data.listings} columns={listingColumns} rowKey={(row) => row.id} />
      <DetailTable id="productinventory" title="库存" caption="商品库存" rows={data.inventory} columns={stockColumns} rowKey={(row) => `${row.sku}:${row.scope}:${row.location}`} />
      <DetailTable id="productprices" title="价格" caption="商品价格" rows={data.prices} columns={priceColumns} rowKey={(row) => `${row.sku}:${row.scope}:${row.bookVersion}`} />
    </div>
  );
}

function DetailTable<T extends object>({ id, title, caption, rows, columns, rowKey }: Readonly<{ id: string; title: string; caption: string; rows: readonly T[]; columns: readonly DataColumn<T>[]; rowKey: (row: T) => string }>) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {rows.length === 0 ? <p role="status">当前授权范围暂无{title}数据。</p> : <DataTable caption={caption} rows={rows} columns={columns} rowKey={rowKey} />}
    </section>
  );
}

function formatInteger(value: number | string): string {
  const normalized = String(value);
  if (!/^-?\d+$/.test(normalized)) return '—';
  const sign = normalized.startsWith('-') ? '-' : '';
  const digits = sign === '' ? normalized : normalized.slice(1);
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDatabaseMinor(value: number | string, currency: string): string {
  const normalized = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(normalized) ? formatMinor(normalized, currency) : `${formatInteger(value)} ${currency} 分`;
}
