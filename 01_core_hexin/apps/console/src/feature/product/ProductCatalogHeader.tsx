import type { ListingPage } from './ProductSchema';
import { ProductIcon } from './ProductIcon';

interface ProductCatalogHeaderProps {
  readonly page?: ListingPage;
  readonly previewEnabled: boolean;
  readonly status: string;
  readonly onStatus: (status: string) => void;
  readonly exportReady: boolean;
  readonly writeEnabled: boolean;
  readonly releaseEnabled: boolean;
  readonly releasePending: boolean;
  readonly onImport: () => void;
  readonly onCreate: () => void;
  readonly onExport: () => void;
  readonly onRelease: () => void;
}

const tabs = Object.freeze([
  { key: '', label: '全部商品' },
  { key: 'needs_attention', label: '待完善' },
  { key: 'pending_review', label: '待审核' },
  { key: 'published', label: '已上架' },
  { key: 'unpublished', label: '已下架' },
] as const);

export function ProductCatalogHeader({ page, previewEnabled, status, onStatus, exportReady, writeEnabled, releaseEnabled,
  releasePending, onImport, onCreate, onExport, onRelease }: ProductCatalogHeaderProps) {
  const preview = previewEnabled && page?.preview?.kind === 'console-product-v1' ? page.preview : undefined;
  const coreTotal = preview === undefined ? page?.total_count : preview.facets.statuses.reduce((total, facet) => total + facet.count, 0) || preview.totalCount;
  const description = coreTotal === undefined ? '正在读取当前范围商品总量与管理状态。' : `当前范围内共 ${formatCount(coreTotal)} 件商品`;

  return (
    <>
      <header className="producthero">
        <div>
          <p className="producteyebrow">CATALOG OPERATIONS</p>
          <h1>商品管理</h1>
          <p>{description}</p>
        </div>
        <div className="productheroactions" role="group" aria-label="商品管理操作">
          <button className="productaction productactionprimary" type="button"
            disabled={!releaseEnabled || releasePending || (page?.status_counts?.pending_review ?? 0) === 0}
            onClick={onRelease}
            title={releaseEnabled ? '一次审核并上架当前商城全部合格商品' : '当前商城范围没有批量上架权限'}>
            <ProductIcon name="store" />
            {releasePending ? '正在发布…' : `一键审核上架${page?.status_counts === undefined ? '' : ` ${formatCount(page.status_counts.pending_review)}`}`}
          </button>
          <button className="productaction" type="button" disabled={!writeEnabled} onClick={onImport}
            title={writeEnabled ? '上传 catalog-package/v1 标准货盘包' : '请切换到有商品导入权限的商城范围'}>
            <ProductIcon name="upload" />批量导入
          </button>
          <button className="productaction" type="button" disabled={!exportReady} onClick={onExport}
            title={exportReady ? '仅导出当前已加载页，不包含其他分页' : '等待当前页加载完成'}>
            <ProductIcon name="download" />导出当前页
          </button>
          <button className="productaction" type="button" disabled={!writeEnabled} onClick={onCreate}
            title={writeEnabled ? '手工录入单个商品并保存为草稿' : '请切换到有商品导入权限的商城范围'}>
            <ProductIcon name="plus" />新建商品
          </button>
        </div>
        <p id="productcontractnotice" className="sr-only">
          商品写操作只在当前 Access Pipeline 已授权的商城范围内可用。
        </p>
      </header>
      <nav className="producttabs" aria-label="商品状态">
        {tabs.map((tab) => {
          const count = tab.key === '' ? coreTotal : preview?.facets.statuses.find((facet) => facet.value === tab.key)?.count
            ?? page?.status_counts?.[tab.key];
          const disabled = tab.key !== '' && !previewEnabled && page?.status_counts === undefined;
          return (
            <button key={tab.key || 'all'} type="button" aria-current={status === tab.key ? 'page' : undefined} disabled={disabled} title={disabled ? '正在读取状态统计' : undefined} onClick={() => onStatus(tab.key)}>
              {tab.label}
              {count === undefined ? null : <strong>{formatCount(count)}</strong>}
            </button>
          );
        })}
      </nav>
    </>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}
