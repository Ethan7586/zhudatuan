import { ProductIcon } from './ProductIcon';

interface ProductCatalogHeaderProps {
  readonly title: string;
  readonly onCreate: () => void;
  readonly onPools: () => void;
  readonly onImport: () => void;
  readonly canCreate: boolean;
  readonly createReason?: string;
  readonly canPools: boolean;
  readonly poolReason?: string;
  readonly canImport: boolean;
  readonly importReason?: string;
}

export function ProductHeader({ title, onCreate, onPools, onImport, canCreate, createReason, canPools, poolReason, canImport, importReason }: ProductCatalogHeaderProps) {
  return (
    <>
      <header className="producthero">
        <div>
          <p className="producteyebrow">商品运营</p>
          <h1>{title}</h1>
          <p>统一维护商品主档、规格、价格、库存、上下架状态与商品池投放关系。</p>
        </div>
        <div className="productheroactions" role="group" aria-label="商品管理操作">
          <button className="productaction" type="button" onClick={onImport} disabled={!canImport} title={importReason}>
            <ProductIcon name="upload" />
            导入商品
          </button>
          <button className="productaction" type="button" onClick={onPools} disabled={!canPools} title={poolReason}>
            <ProductIcon name="upload" />
            商品池
          </button>
          <button className="productaction productactionprimary" type="button" onClick={onCreate} disabled={!canCreate} title={createReason}>
            <ProductIcon name="plus" />
            新建商品
          </button>
        </div>
        <p id="productcontractnotice" className="sr-only">
          商品池和商品写操作使用服务端受控操作、权限、版本校验与回执合同。
        </p>
      </header>
    </>
  );
}
