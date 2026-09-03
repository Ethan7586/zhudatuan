import { ProductIcon } from './ProductIcon';
import { useRouteTitle } from '../../shared/ui/RouteTitle';

interface ProductCatalogHeaderProps {
  readonly status: string;
  readonly onStatus: (status: string) => void;
  readonly onCreate: () => void;
  readonly onPools: () => void;
}

const tabs = Object.freeze([
  { key: '', label: '核心商品' },
  { key: 'needs_attention', label: '待完善' },
  { key: 'pending_review', label: '待审核' },
  { key: 'unpublished', label: '已下架' },
] as const);

export function ProductCatalogHeader({ status, onStatus, onCreate, onPools }: ProductCatalogHeaderProps) {
  const title = useRouteTitle('商品池');

  return (
    <>
      <header className="producthero">
        <div>
          <p className="producteyebrow">商品运营</p>
          <h1>{title}</h1>
          <p>当前范围商品按服务端过滤与游标分页读取；总量尚未由列表合同返回。</p>
        </div>
        <div className="productheroactions" role="group" aria-label="商品管理操作">
          <button className="productaction" type="button" onClick={onPools}>
            <ProductIcon name="upload" />
            商品池
          </button>
          <UnavailableAction icon="download" label="导出" reason="导出快照合同尚未提供" />
          <button className="productaction productactionprimary" type="button" onClick={onCreate}>
            <ProductIcon name="plus" />
            新建商品
          </button>
        </div>
        <p id="productcontractnotice" className="sr-only">
          商品池和商品写操作使用服务端受控操作、权限、版本校验与回执合同。
        </p>
      </header>
      <nav className="producttabs" aria-label="商品状态">
        {tabs.map((tab) => {
          return (
            <button key={tab.key || 'core'} type="button" aria-current={status === tab.key ? 'page' : undefined} onClick={() => onStatus(tab.key)}>
              {tab.label}
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
}: Readonly<{
  icon: 'upload' | 'download' | 'plus';
  label: string;
  reason: string;
}>) {
  return (
    <button className="productaction" type="button" disabled title={reason} aria-describedby="productcontractnotice">
      <ProductIcon name={icon} />
      {label}
    </button>
  );
}
