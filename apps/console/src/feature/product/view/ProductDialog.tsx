import { useEffect, useRef, type FormEvent } from 'react';
import { OP_CATALOG_LISTINGS_PRICE_SET, OP_CATALOG_LISTINGS_PUBLISH, OP_CATALOG_LISTINGS_UNPUBLISH, OP_CATALOG_PRODUCTS_ARCHIVE, OP_CATALOG_PRODUCTS_CREATE, OP_CATALOG_PRODUCTS_UPDATE } from '@shop/contract/ids';
import { Button } from '@shop/design';
import { PRODUCT_STATUS_OPTIONS, PRODUCT_TYPE_OPTIONS, presentProductAction } from '@shop/presentation';
import type { ProductAction } from '../model/ProductAction';
import type { ProductActionViewModel } from '../viewmodel/ProductActionViewModel';
import { ProductIcon } from './ProductIcon';
import { ProductImageField } from './ProductImageField';
import { ProductCategoryField } from './ProductCategoryField';
import { ProductFlowModal } from './ProductFlowModal';

export function ProductDialog({ viewmodel, onClose }: Readonly<{ viewmodel: ProductActionViewModel; onClose: () => void }>) {
  const action = viewmodel.action;
  const titleInput = useRef<HTMLInputElement>(null);
  const priceInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (action?.operation === OP_CATALOG_PRODUCTS_CREATE || action?.operation === OP_CATALOG_PRODUCTS_UPDATE) titleInput.current?.focus();
    if (action?.operation === OP_CATALOG_LISTINGS_PRICE_SET) priceInput.current?.focus();
  }, [action]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    viewmodel.submit();
  };
  if (action === null) return null;
  return (
    <ProductFlowModal open label={presentProductAction(action.operation).title} onClose={onClose} dismissable={!viewmodel.submitting}>
      <form className="productflowcontent" aria-label={presentProductAction(action.operation).title} onSubmit={submit}>
        <header>
          <div>
            <p>商品操作</p>
            <h2>{presentProductAction(action.operation).title}</h2>
          </div>
          <Button className="productflowclose" tone="quiet" onPress={onClose} aria-label="关闭商品操作窗口" isDisabled={viewmodel.submitting}>
            <ProductIcon name="close" />
          </Button>
        </header>
        <div className="productflowbody">
          {action.operation === OP_CATALOG_PRODUCTS_CREATE || action.operation === OP_CATALOG_PRODUCTS_UPDATE ? (
            <>
              <label>
                商品名称
                <input ref={titleInput} value={viewmodel.title} onChange={(event) => viewmodel.setTitle(event.target.value)} required maxLength={160} disabled={viewmodel.submitting} />
              </label>
              <ProductCategoryField viewmodel={viewmodel.categories} disabled={viewmodel.submitting} />
              {action.operation === OP_CATALOG_PRODUCTS_CREATE ? (
                <label>
                  商品类型
                  <select value={viewmodel.type} onChange={(event) => viewmodel.setType(event.target.value as ProductActionViewModel['type'])} disabled={viewmodel.submitting}>
                    {PRODUCT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {action.operation === OP_CATALOG_PRODUCTS_UPDATE ? (
                <label>
                  商品状态
                  <select value={viewmodel.status} onChange={(event) => viewmodel.setStatus(event.target.value as ProductActionViewModel['status'])} disabled={viewmodel.submitting}>
                    {PRODUCT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <ProductImageField
                current={viewmodel.currentImage}
                image={viewmodel.image}
                error={viewmodel.imageError}
                canChoose={viewmodel.canUploadImage}
                permissionReason={viewmodel.imagePermissionReason}
                disabled={viewmodel.submitting}
                progress={viewmodel.imageProgress}
                title={viewmodel.title}
                onChoose={viewmodel.chooseImage}
                onRemove={viewmodel.removeImage}
              />
            </>
          ) : null}
          {action.operation === OP_CATALOG_LISTINGS_PRICE_SET ? (
            <label>
              销售价（元）
              <input ref={priceInput} type="number" min="0.01" max="999999.99" step="0.01" value={viewmodel.amount} onChange={(event) => viewmodel.setAmount(event.target.value)} required disabled={viewmodel.submitting} />
            </label>
          ) : null}
          <ProductActionMessage action={action} />
          {viewmodel.error === undefined ? null : (
            <p role="alert" className="productflowerror">
              {viewmodel.error}
            </p>
          )}
          {viewmodel.permissionReason === undefined ? null : (
            <p id="productactionpermission" role="alert" className="productflowerror">
              {viewmodel.permissionReason}
            </p>
          )}
        </div>
        <footer>
          <Button onPress={onClose} isDisabled={viewmodel.submitting}>
            取消
          </Button>
          <Button
            tone="primary"
            type="submit"
            isDisabled={viewmodel.submitting || !viewmodel.allowed || viewmodel.categories.blocked || viewmodel.imageError !== undefined || (viewmodel.image instanceof File && !viewmodel.canUploadImage)}
            {...(viewmodel.permissionReason === undefined ? {} : { 'aria-describedby': 'productactionpermission' })}
          >
            {viewmodel.submitting ? viewmodel.submittingLabel : presentProductAction(action.operation).submit}
          </Button>
        </footer>
      </form>
    </ProductFlowModal>
  );
}

function ProductActionMessage({ action }: Readonly<{ action: ProductAction }>) {
  if (action.operation === OP_CATALOG_PRODUCTS_ARCHIVE) return <p>归档商品“{action.listing.title}”后将不可继续销售；历史订单保持不变。</p>;
  if (action.operation === OP_CATALOG_LISTINGS_PUBLISH || action.operation === OP_CATALOG_LISTINGS_UNPUBLISH)
    return (
      <p>
        确认{presentProductAction(action.operation).verb}“{action.listing.title}”？该操作使用当前列表版本进行并发校验。
      </p>
    );
  if (action.operation === OP_CATALOG_PRODUCTS_CREATE) return <p className="productflownote">商品先以草稿创建；商品规格与商品池投放由后续独立流程完成。</p>;
  return null;
}
