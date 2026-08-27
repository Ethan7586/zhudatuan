import type { ListingPage } from './ProductSchema';
import { ProductIcon } from './ProductIcon';

interface ProductCatalogHeaderProps {
  readonly page?: ListingPage;
  readonly previewEnabled: boolean;
  readonly status: string;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  readonly exportReady: boolean;
  readonly onImport: () => void;
  readonly onExport: () => void;
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  readonly exportReady: boolean;
  readonly onImport: () => void;
  readonly onExport: () => void;
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  readonly onStatus: (status: string) => void;
}

const tabs = Object.freeze([
  { key: '', label: '核心商品' },
  { key: 'needs_attention', label: '待完善' },
  { key: 'pending_review', label: '待审核' },
  { key: 'unpublished', label: '已下架' },
] as const);

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
export function ProductCatalogHeader({ page, previewEnabled, status, exportReady, onImport, onExport, onStatus }: ProductCatalogHeaderProps) {
=======
export function ProductCatalogHeader({ page, previewEnabled, status, onStatus }: ProductCatalogHeaderProps) {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
export function ProductCatalogHeader({ page, previewEnabled, status, exportReady, onImport, onExport, onStatus }: ProductCatalogHeaderProps) {
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
export function ProductCatalogHeader({ page, previewEnabled, status, onStatus }: ProductCatalogHeaderProps) {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
          <button className="productaction" type="button" title="选择本地 CSV 文件，本期不会上传" aria-describedby="productcontractnotice" onClick={onImport}>
            <ProductIcon name="upload" />
            导入
          </button>
          <button
            className="productaction"
            type="button"
            disabled={!exportReady}
            title={exportReady ? '仅导出当前已加载页，不包含其他分页' : '数据加载中'}
            aria-describedby="productcontractnotice"
            onClick={onExport}
          >
            <ProductIcon name="download" />
            导出当前页
          </button>
<<<<<<< HEAD
          <UnavailableAction primary icon="plus" label="新建商品" reason="商品创建表单与操作回执尚未闭合" />
        </div>
        <p id="productcontractnotice" className="sr-only">
          导入只提供本地文件交互预览，文件不会上传；当前页导出只使用浏览器已经加载的服务端读模型。新建商品保持不可用。
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
          <UnavailableAction icon="upload" label="导入" reason="导入任务合同尚未接入此工作台" />
          <UnavailableAction icon="download" label="导出" reason="导出快照合同尚未提供" />
          <UnavailableAction primary icon="plus" label="新建商品" reason="商品创建表单与操作回执尚未闭合" />
        </div>
        <p id="productcontractnotice" className="sr-only">
          这些写操作保持不可用，直到服务端 Operation、权限、版本校验和回执合同全部就绪。
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
          <UnavailableAction primary icon="plus" label="新建商品" reason="商品创建表单与操作回执尚未闭合" />
        </div>
        <p id="productcontractnotice" className="sr-only">
          导入只提供本地文件交互预览，文件不会上传；当前页导出只使用浏览器已经加载的服务端读模型。新建商品保持不可用。
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
