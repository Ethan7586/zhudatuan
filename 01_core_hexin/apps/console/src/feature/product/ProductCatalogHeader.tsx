import type { ListingPage } from './ProductSchema';
import { ProductIcon } from './ProductIcon';

interface ProductCatalogHeaderProps {
  readonly page?: ListingPage;
  readonly previewEnabled: boolean;
  readonly status: string;
  readonly onStatus: (status: string) => void;
  readonly exportReady: boolean;
  readonly onImport: () => void;
  readonly onExport: () => void;
}

const tabs = Object.freeze([
  { key: '', label: '核心商品' },
  { key: 'needs_attention', label: '待完善' },
  { key: 'pending_review', label: '待审核' },
  { key: 'unpublished', label: '已下架' },
] as const);

export function ProductCatalogHeader({ page, previewEnabled, status, onStatus, exportReady, onImport, onExport }: ProductCatalogHeaderProps) {
  const preview = previewEnabled && page?.preview?.kind === 'console-product-v1' ? page.preview : undefined;
  const coreTotal = preview === undefined ? undefined : preview.facets.statuses.reduce((total, facet) => total + facet.count, 0) || preview.totalCount;
  const description = preview === undefined ? '当前范围商品按服务端过滤与游标分页读取；总量尚未由列表合同返回。' : `当前范围内共 ${formatCount(coreTotal ?? preview.totalCount)} 件核心商品`;

  return (
    <>
      <header className="producthero">
        <div>
          <p className="producteyebrow">CATALOG OPERATIONS</p>
          <h1>商品管理</h1>
          <p>{description}</p>
        </div>
        <div className="productheroactions" role="group" aria-label="商品管理操作">
          <button className="productaction" type="button" onClick={onImport}><ProductIcon name="upload" />导入</button>
          <button className="productaction" type="button" disabled={!exportReady} onClick={onExport}
            title={exportReady ? '仅导出当前已加载页，不包含其他分页' : '等待当前页加载完成'}>
            <ProductIcon name="download" />导出当前页
          </button>
          <UnavailableAction primary icon="plus" label="新建商品" reason="商品创建表单与操作回执尚未闭合" />
        </div>
        <p id="productcontractnotice" className="sr-only">
          这些写操作保持不可用，直到服务端 Operation、权限、版本校验和回执合同全部就绪。
        </p>
      </header>
      <nav className="producttabs" aria-label="商品状态">
        {tabs.map((tab) => {
          const count = tab.key === '' ? coreTotal : preview?.facets.statuses.find((facet) => facet.value === tab.key)?.count;
          const disabled = tab.key !== '' && !previewEnabled;
          return (
            <button key={tab.key || 'core'} type="button" aria-current={status === tab.key ? 'page' : undefined} disabled={disabled} title={disabled ? '状态聚合与过滤合同尚未提供' : undefined} onClick={() => onStatus(tab.key)}>
              {tab.label}
              {count === undefined ? null : <strong>{formatCount(count)}</strong>}
            </button>
          );
        })}
      </nav>
    </>
  );
}

function UnavailableAction({
  icon,
  label,
  reason,
  primary = false,
}: Readonly<{
  icon: 'upload' | 'download' | 'plus';
  label: string;
  reason: string;
  primary?: boolean;
}>) {
  return (
    <button className={primary ? 'productaction productactionprimary' : 'productaction'} type="button" disabled title={reason} aria-describedby="productcontractnotice">
      <ProductIcon name={icon} />
      {label}
    </button>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}
