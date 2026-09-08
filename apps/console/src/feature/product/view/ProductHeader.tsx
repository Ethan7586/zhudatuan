import { Button } from '@shop/design';
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
  const reasons = [...new Set([canImport ? undefined : importReason, canPools ? undefined : poolReason, canCreate ? undefined : createReason].filter((reason): reason is string => reason !== undefined))];
  return (
    <>
      <header className="producthero">
        <div>
          <p className="producteyebrow">商品运营</p>
          <h1>{title}</h1>
          <p>统一维护商品主档、规格、价格、库存、上下架状态与商品池投放关系。</p>
        </div>
        <div className="productheroactionarea">
          <div className="productheroactions" role="group" aria-label="商品管理操作">
            <Button className="productaction" onPress={onImport} isDisabled={!canImport} {...(!canImport && importReason !== undefined ? { 'aria-describedby': 'productactionreason' } : {})}>
              <ProductIcon name="upload" />
              导入商品
            </Button>
            <Button className="productaction" onPress={onPools} isDisabled={!canPools} {...(!canPools && poolReason !== undefined ? { 'aria-describedby': 'productactionreason' } : {})}>
              <ProductIcon name="inventory" />
              商品池
            </Button>
            <Button className="productaction" tone="primary" onPress={onCreate} isDisabled={!canCreate} {...(!canCreate && createReason !== undefined ? { 'aria-describedby': 'productactionreason' } : {})}>
              <ProductIcon name="plus" />
              新建商品
            </Button>
          </div>
          {reasons.length === 0 ? null : <p id="productactionreason" className="productheroreason">{reasons.join('；')}</p>}
        </div>
        <p id="productcontractnotice" className="sr-only">
          商品池和商品写操作使用服务端受控操作、权限、版本校验与回执合同。
        </p>
      </header>
    </>
  );
}
