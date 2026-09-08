import type { KeyboardEvent, MouseEvent } from 'react';
import { ProductIcon } from './ProductIcon';
import type { ListingPublicationAction } from './ProductPublicationCommand';
import type { Listing } from './ProductSchema';

export type ProductColumnKey = 'category' | 'sku' | 'malls' | 'price' | 'stock' | 'status' | 'updated';

interface ProductTableProps {
  readonly rows: readonly Listing[];
  readonly previewEnabled: boolean;
  readonly visibleColumns: ReadonlySet<ProductColumnKey>;
  readonly selected: ReadonlySet<string>;
  readonly activeId?: string;
  readonly onToggle: (id: string) => void;
  readonly onToggleAll: () => void;
  readonly onOpen: (row: Listing) => void;
  readonly onBatchPreview: () => void;
  readonly canPublish: boolean;
  readonly canUnpublish: boolean;
  readonly publicationPending?: string;
  readonly onPublication: (row: Listing, action: ListingPublicationAction) => void;
}

export function ProductTable({ rows, previewEnabled, visibleColumns, selected, activeId, onToggle, onToggleAll, onOpen,
  onBatchPreview, canPublish, canUnpublish, publicationPending, onPublication }: ProductTableProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  return (
    <section className="producttablecard" aria-labelledby="productlisttitle">
      <h2 id="productlisttitle" className="sr-only">
        商品列表
      </h2>
      {selected.size === 0 ? null : (
        <div className="productselectionbar" role="status">
          <span>
            已选择当前页 <strong>{selected.size}</strong> 项
          </span>
          <span>页面顶部的一键审核上架会处理当前商城全部合格商品</span>
          <button type="button" onClick={onBatchPreview}>
            查看所选
          </button>
        </div>
      )}
      <div className="producttablewrap">
        <table aria-label="商品列表">
          <thead>
            <tr>
              <th className="productcheckcell">
                <input type="checkbox" aria-label="选择本页商品" checked={allSelected} onChange={onToggleAll} />
              </th>
              <th>商品信息</th>
              {visibleColumns.has('category') ? <th>分类 / 供应商</th> : null}
              {visibleColumns.has('sku') ? <th>SKU 数量</th> : null}
              {visibleColumns.has('malls') ? <th>商城覆盖</th> : null}
              {visibleColumns.has('price') ? <th>售价</th> : null}
              {visibleColumns.has('stock') ? <th>库存</th> : null}
              {visibleColumns.has('status') ? <th>状态</th> : null}
              {visibleColumns.has('updated') ? <th>更新时间</th> : null}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const preview = previewEnabled && row.preview?.kind === 'console-product-v1' ? row.preview : undefined;
              const publicationAction: ListingPublicationAction = row.status === 'published' ? 'unpublish' : 'publish';
              const publicationEnabled = publicationAction === 'publish' ? canPublish : canUnpublish;
              const managementStatus = row.management_status ?? row.status;
              const publicationLabel = publicationAction === 'unpublish' ? '下架'
                : managementStatus === 'pending_review' ? '审核上架'
                  : managementStatus === 'unpublished' ? '重新上架' : '上架';
              return (
                <tr key={row.id} data-active={activeId === row.id ? 'true' : undefined} onClick={() => onOpen(row)}>
                  <td className="productcheckcell">
                    <input type="checkbox" aria-label={`选择 ${row.title}`} checked={selected.has(row.id)} onClick={stopClick} onChange={() => onToggle(row.id)} />
                  </td>
                  <td>
                    <div className="productidentity">
                      <ProductThumbnail row={row} {...(preview?.tone === undefined ? {} : { tone: preview.tone })} />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(row);
                        }}
                      >
                        <strong>{row.title}</strong>
                        <span>{preview?.spu ?? row.product_id}</span>
                      </button>
                    </div>
                  </td>
                  {visibleColumns.has('category') ? (
                    <td>
                      <CellPair primary={preview?.categoryName ?? productType(row.product_type)} secondary={preview?.supplier.name ?? '供应商合同待补'} unavailable={preview === undefined} />
                    </td>
                  ) : null}
                  {visibleColumns.has('sku') ? <td>{preview === undefined
                    ? row.sku_count === undefined ? <Unavailable /> : formatCount(row.sku_count)
                    : `${preview.skuCount}/${preview.skuTotal}`}</td> : null}
                  {visibleColumns.has('malls') ? <td>{preview === undefined ? <Unavailable /> : `${preview.mallCount}/${preview.mallTotal}`}</td> : null}
                  {visibleColumns.has('price') ? <td className="productmoney">{preview?.priceCents == null ? <Unavailable /> : formatMoney(preview.priceCents)}</td> : null}
                  {visibleColumns.has('stock') ? <td>{preview?.inventory == null ? <Unavailable /> : formatCount(preview.inventory)}</td> : null}
                  {visibleColumns.has('status') ? (
                    <td>
                      <StatusBadge status={managementStatus} />
                    </td>
                  ) : null}
                  {visibleColumns.has('updated') ? <td className="producttime">{formatTime(row.cursor_sort)}</td> : null}
                  <td>
                    <div className="productrowactions">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(row);
                        }}
                      >
                        <ProductIcon name="eye" />
                        查看
                      </button>
                      <button type="button" aria-label={`${publicationLabel} ${row.title}`}
                        disabled={!publicationEnabled || publicationPending !== undefined}
                        title={publicationEnabled ? `${publicationLabel}当前商城货架` : '当前商城范围没有货架写权限'}
                        onClick={(event) => { event.stopPropagation(); onPublication(row, publicationAction); }}>
                        <ProductIcon name={publicationAction === 'publish' ? 'store' : 'archive'} />
                        {publicationPending === row.id ? '处理中' : publicationLabel}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductThumbnail({ row, tone }: Readonly<{ row: Listing; tone?: string }>) {
  return (
    <span className="productthumbnail" data-tone={tone ?? 'neutral'}>
      {row.cover_url == null || row.cover_url === '' ? <ProductIcon name="cube" /> : <img src={row.cover_url} alt="" />}
    </span>
  );
}

function CellPair({
  primary,
  secondary,
  unavailable = false,
}: Readonly<{
  primary: string;
  secondary: string;
  unavailable?: boolean;
}>) {
  return (
    <span className={unavailable ? 'productcellpair isunavailable' : 'productcellpair'}>
      <strong>{primary}</strong>
      <small>{secondary}</small>
    </span>
  );
}

function Unavailable() {
  return (
    <span className="productunavailable" title="当前列表合同未提供">
      —
    </span>
  );
}

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  const mapped = statusLabel(status);
  return (
    <span className="productstatus" data-tone={mapped.tone}>
      <i aria-hidden="true">
        <ProductIcon name={mapped.icon} />
      </i>
      {mapped.label}
    </span>
  );
}

function statusLabel(status: string): Readonly<{ label: string; tone: string; icon: 'check' | 'warning' }> {
  if (status === 'available') return { label: '已上架', tone: 'success', icon: 'check' };
  if (status === 'needs_attention') return { label: '待完善', tone: 'warning', icon: 'warning' };
  if (status === 'pending_listing') return { label: '待上架', tone: 'info', icon: 'warning' };
  if (status === 'pending_review') return { label: '待审核', tone: 'info', icon: 'warning' };
  if (status === 'unpublished') return { label: '已下架', tone: 'muted', icon: 'warning' };
  if (status === 'published') return { label: '已上架', tone: 'success', icon: 'check' };
  if (status === 'partial') return { label: '部分上架', tone: 'warning', icon: 'warning' };
  if (status === 'pending') return { label: '待上架', tone: 'info', icon: 'warning' };
  if (status === 'review') return { label: '待审核', tone: 'info', icon: 'warning' };
  if (status === 'incomplete') return { label: '待完善', tone: 'warning', icon: 'warning' };
  if (status === 'offline' || status === 'archived') return { label: '已下架', tone: 'muted', icon: 'warning' };
  return { label: status, tone: 'neutral', icon: 'check' };
}

function productType(value: string | null | undefined): string {
  if (value === 'physical') return '实物商品';
  if (value === 'digital') return '数字商品';
  return value ?? '分类合同待补';
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatTime(value: string | undefined): string {
  if (value === undefined) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '--';
  return `${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

function stopClick(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation();
}
