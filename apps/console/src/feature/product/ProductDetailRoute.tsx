import { queryCondition, safeQueryError } from '@shop/presentation';
import { Button, ResourcePanel } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';

import { DataTable, type DataColumn } from '../../shared/ui/DataTable';
import { formatDate, formatMinor } from '../../shared/ui/Format';
import { MetricCards } from '../../shared/ui/MetricCards';
import { useRouteTitle } from '../../shared/ui/RouteTitle';
import { productDetailKey, readProductDetail, type ProductDetail } from './ProductQuery';

type Sku = ProductDetail['skus'][number];
type Listing = ProductDetail['listings'][number];
type Stock = ProductDetail['inventory'][number];
type Price = ProductDetail['prices'][number];

const skuColumns: readonly DataColumn<Sku>[] = Object.freeze([
  { key: 'code', label: 'SKU 编码', render: (row) => row.code },
  { key: 'specifications', label: '规格', render: (row) => row.specifications.map((item) => `${item.name}：${item.value}`).join(' · ') || '—' },
  { key: 'status', label: '状态', render: (row) => row.status },
  { key: 'version', label: '版本', render: (row) => `v${formatInteger(row.version)}` },
]);

const listingColumns: readonly DataColumn<Listing>[] = Object.freeze([
  { key: 'title', label: '商城标题', render: (row) => row.title },
  { key: 'scope', label: '商城范围', render: (row) => row.scope },
  { key: 'pool', label: '来源池', render: (row) => row.pool ?? '未绑定' },
  { key: 'sku', label: 'SKU', render: (row) => row.sku },
  { key: 'status', label: '上架状态', render: (row) => row.status },
  { key: 'effective', label: '生效时间', render: (row) => formatDate(row.effectiveAt) },
  { key: 'expires', label: '失效时间', render: (row) => formatDate(row.expiresAt) },
]);

const stockColumns: readonly DataColumn<Stock>[] = Object.freeze([
  { key: 'sku', label: 'SKU', render: (row) => row.sku },
  { key: 'scope', label: '库存范围', render: (row) => row.scope },
  { key: 'location', label: '库位', render: (row) => row.location },
  { key: 'onhand', label: '在手库存', render: (row) => formatInteger(row.onhand) },
  { key: 'safety', label: '安全库存', render: (row) => formatInteger(row.safety) },
  { key: 'status', label: '状态', render: (row) => row.status },
]);

const priceColumns: readonly DataColumn<Price>[] = Object.freeze([
  { key: 'sku', label: 'SKU', render: (row) => row.sku },
  { key: 'scope', label: '价格范围', render: (row) => row.scope },
  { key: 'price', label: '当前售价', render: (row) => formatDatabaseMinor(row.amountMinor, row.currency) },
  { key: 'compare', label: '划线价', render: (row) => (row.compareMinor === null ? '—' : formatDatabaseMinor(row.compareMinor, row.currency)) },
  { key: 'status', label: '价格簿状态', render: (row) => row.bookStatus },
  { key: 'effective', label: '生效时间', render: (row) => formatDate(row.effectiveAt) },
  { key: 'expires', label: '失效时间', render: (row) => formatDate(row.expiresAt) },
]);

export function Component() {
  const context = useConsoleContext();
  const routeTitle = useRouteTitle('商品池');
  const productId = useParams().productId ?? '';
  const query = useQuery({
    queryKey: productDetailKey(context, productId),
    queryFn: ({ signal }) => readProductDetail(context, productId, signal),
    enabled: productId !== '',
    staleTime: 60_000,
  });
  const error = safeQueryError(query.error);
  const condition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: query.data !== undefined,
    empty: false,
  });
  const data = query.data;
  return (
    <ResourcePanel
      title={routeTitle}
      eyebrow="SMART WING PRODUCT DETAIL"
      description={data === undefined ? `正在读取商品 ${productId} 的服务端详情。` : `${data.title} · ${data.subtitle ?? '服务端商品主档'} · ${data.id}`}
      condition={condition}
      {...(error === undefined ? {} : { error })}
      retry={() => void query.refetch()}
      actions={<Button onPress={() => void query.refetch()}>刷新</Button>}
    >
      {data === undefined ? <span /> : <ProductDetailContent data={data} scope={context.scope.id} />}
    </ResourcePanel>
  );
}

function ProductDetailContent({ data, scope }: Readonly<{ data: ProductDetail; scope: string }>) {
  return (
    <div className="featurestack">
      <MetricCards
        items={[
          { label: '商品状态', value: data.status, detail: data.product_type },
          { label: 'SKU', value: formatInteger(data.skus.length), detail: '商品主档投影' },
          { label: '商城上架', value: formatInteger(data.listings.length), detail: '当前范围可见' },
          { label: '库存记录', value: formatInteger(data.inventory.length), detail: '当前范围可见' },
          { label: '价格记录', value: formatInteger(data.prices.length), detail: '当前范围可见' },
          { label: '主档版本', value: `v${formatInteger(data.version)}`, detail: data.category_id },
        ]}
      />
      <section className="capabilitynote" aria-labelledby="productdetailscope">
        <h2 id="productdetailscope">范围与来源责任</h2>
        <p>商品主档来自 Catalog；SKU、商城上架、库存与价格由服务端按 {scope} 授权范围聚合，只呈现合同允许的字段。</p>
      </section>
      <DetailTable id="productskus" title="SKU 与规格" caption="商品 SKU 与规格" rows={data.skus} columns={skuColumns} rowKey={(row) => row.id} />
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
