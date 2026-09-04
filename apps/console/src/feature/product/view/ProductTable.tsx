import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { chineseReference, presentCatalogGap, presentProductSource, presentProductStatus } from '@shop/presentation';
import { ProductIcon } from './ProductIcon';
import type { Listing } from '../model/Product';
import { ProductSelectionBar } from './ProductSelectionBar';
export type ProductColumnKey = 'category' | 'sku' | 'malls' | 'price' | 'stock' | 'status' | 'updated';

interface ProductTableProps {
  readonly rows: readonly Listing[];
  readonly visibleColumns: ReadonlySet<ProductColumnKey>;
  readonly selected: ReadonlySet<string>;
  readonly activeId?: string;
  readonly onToggle: (id: string) => void;
  readonly onToggleAll: () => void;
  readonly onOpen: (row: Listing) => void;
  readonly onBatch: (published: boolean) => void;
  readonly canBatch: boolean;
  readonly batchReason?: string;
}

export function ProductTable({ rows, visibleColumns, selected, activeId, onToggle, onToggleAll, onOpen, onBatch, canBatch, batchReason }: ProductTableProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  return (
    <section className="producttablecard" aria-labelledby="productlisttitle">
      <h2 id="productlisttitle" className="sr-only">
        商品列表
      </h2>
      <ProductSelectionBar count={selected.size} canBatch={canBatch} onBatch={onBatch} {...(batchReason === undefined ? {} : { batchReason })} />
      <div className="producttablewrap">
        <table aria-label="商品列表">
          <thead>
            <tr>
              <th className="productcheckcell">
                <input type="checkbox" aria-label="选择本页商品" checked={allSelected} onChange={onToggleAll} />
              </th>
              <th>商品信息</th>
              {visibleColumns.has('category') ? <th>分类 / 来源</th> : null}
              {visibleColumns.has('sku') ? <th>SKU 摘要</th> : null}
              {visibleColumns.has('malls') ? <th>商城覆盖</th> : null}
              {visibleColumns.has('price') ? <th>有效售价</th> : null}
              {visibleColumns.has('stock') ? <th>可售库存</th> : null}
              {visibleColumns.has('status') ? <th>状态</th> : null}
              {visibleColumns.has('updated') ? <th>更新时间</th> : null}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-active={activeId === row.id ? 'true' : undefined} onClick={() => onOpen(row)}>
                <td className="productcheckcell">
                  <input type="checkbox" aria-label={`选择 ${row.title}`} checked={selected.has(row.id)} onClick={stopClick} onChange={() => onToggle(row.id)} />
                </td>
                <td data-label="商品信息">
                  <div className="productidentity">
                    <ProductThumbnail row={row} />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(row);
                      }}
                    >
                      <strong>{row.title}</strong>
                      <span>{chineseReference('商品', row.product_id)}</span>
                    </button>
                  </div>
                </td>
                {visibleColumns.has('category') ? (
                  <td data-label="分类与来源">
                    <CellPair primary={row.category_name ?? '分类待映射'} secondary={presentProductSource(row.source, row.source_partner_id)} />
                  </td>
                ) : null}
                {visibleColumns.has('sku') ? (
                  <td data-label="规格摘要">
                    <CellPair primary={`${formatCount(row.sku_count)} / ${formatCount(row.sku_total)}`} secondary={row.code ?? chineseReference('规格', row.sku_id)} />
                  </td>
                ) : null}
                {visibleColumns.has('malls') ? (
                  <td data-label="商城覆盖">
                    <CellPair primary={`${formatCount(row.mall_count)} / ${formatCount(row.mall_total)}`} secondary={row.pool_name ?? <DataGap label={gapLabel(row, 'pool')} onOpen={() => onOpen(row)} />} />
                  </td>
                ) : null}
                {visibleColumns.has('price') ? (
                  <td className="productmoney" data-label="有效售价">{row.price_amount_minor === null ? <DataGap label={gapLabel(row, 'price')} onOpen={() => onOpen(row)} /> : formatMoney(row.price_amount_minor, row.price_currency)}</td>
                ) : null}
                {visibleColumns.has('stock') ? <td data-label="可售库存">{row.saleable_stock === null ? <DataGap label={gapLabel(row, 'stock')} onOpen={() => onOpen(row)} /> : formatCount(row.saleable_stock)}</td> : null}
                {visibleColumns.has('status') ? (
                  <td data-label="商品状态">
                    <StatusBadge status={row.status} />
                    {row.qualification_eligible === false ? <DataGap label="资格未通过" onOpen={() => onOpen(row)} /> : null}
                  </td>
                ) : null}
                {visibleColumns.has('updated') ? <td className="producttime" data-label="更新时间">{formatTime(row.cursor_sort)}</td> : null}
                <td data-label="可用操作">
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
                    <button
                      type="button"
                      aria-label={`${row.title}更多操作`}
                      title="打开商品管理操作"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(row);
                      }}
                    >
                      <ProductIcon name="more" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductThumbnail({ row }: Readonly<{ row: Listing }>) {
  return (
    <span className="productthumbnail" data-tone="neutral">
      {row.cover_url == null || row.cover_url === '' ? <ProductIcon name="cube" /> : <img src={row.cover_url} alt="" />}
    </span>
  );
}

function CellPair({ primary, secondary }: Readonly<{ primary: string; secondary: ReactNode }>) {
  return (
    <span className="productcellpair">
      <strong>{primary}</strong>
      <small>{secondary}</small>
    </span>
  );
}

function DataGap({ label, onOpen }: Readonly<{ label: string; onOpen: () => void }>) {
  return (
    <button
      type="button"
      className="productdatagap"
      title={`${label}，查看修复方法`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      {label}
    </button>
  );
}

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  const mapped = presentProductStatus(status);
  return (
    <span className="productstatus" data-tone={mapped.tone}>
      <i aria-hidden="true">
        <ProductIcon name={mapped.icon} />
      </i>
      {mapped.label}
    </span>
  );
}

function gapLabel(row: Listing, kind: 'pool' | 'price' | 'stock'): string {
  if (kind === 'pool') return row.data_gaps.includes('pool_missing') ? presentCatalogGap('pool_missing') : '直属范围';
  if (kind === 'price') return presentCatalogGap(row.data_gaps.includes('pricing_unavailable') ? 'pricing_unavailable' : 'price_missing');
  return presentCatalogGap(row.data_gaps.includes('inventory_unavailable') ? 'inventory_unavailable' : 'inventory_missing');
}

function formatMoney(cents: number, currency: string | null): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: currency ?? 'CNY' }).format(cents / 100);
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
