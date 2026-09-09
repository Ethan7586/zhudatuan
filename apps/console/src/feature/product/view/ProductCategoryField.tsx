import { Button } from '@shop/design';
import type { ProductActionViewModel } from '../viewmodel/ProductActionViewModel';

type ProductCategoryModel = ProductActionViewModel['categories'];

export function ProductCategoryField({ viewmodel, disabled }: Readonly<{ viewmodel: ProductCategoryModel; disabled: boolean }>) {
  const describedBy = viewmodel.queryError === undefined ? 'productcategoryhelp' : 'productcategoryerror';
  return (
    <fieldset className="productcategoryfield" disabled={disabled}>
      <legend>商品分类</legend>
      <div className="productcategoryselect">
        <select aria-label="商品分类" aria-describedby={describedBy} value={viewmodel.selected} onChange={(event) => viewmodel.select(event.target.value)} required>
          <option value="">{viewmodel.loading ? '正在加载分类…' : '请选择商品分类'}</option>
          {viewmodel.categories.map((category) => (
            <option key={category.id} value={category.id} disabled={category.status !== 'active'}>
              {categoryLabel(category)}
            </option>
          ))}
        </select>
        {viewmodel.canCreate ? (
          <Button tone="quiet" onPress={viewmodel.openCreate} isDisabled={viewmodel.creating || viewmodel.adding}>
            新增分类
          </Button>
        ) : null}
      </div>
      {viewmodel.queryError === undefined ? (
        <p id="productcategoryhelp" className={viewmodel.selectionIssue === undefined ? 'productcategoryhelp' : 'productcategoryissue'}>
          {viewmodel.selectionIssue ?? (viewmodel.selectedName === undefined ? '选择顾客最容易理解的分类；保存时系统会使用内部标识。' : `已选择“${viewmodel.selectedName}”。`)}
        </p>
      ) : (
        <div id="productcategoryerror" className="productcategoryissue" role="alert">
          <span>分类加载失败：{viewmodel.queryError}</span>
          <Button tone="quiet" onPress={viewmodel.retry}>重新加载</Button>
        </div>
      )}
      {viewmodel.canCreate || viewmodel.createReason === undefined ? null : <p className="productcategoryreason">{viewmodel.createReason}</p>}
      {viewmodel.adding ? <CategoryCreator viewmodel={viewmodel} /> : null}
    </fieldset>
  );
}

function CategoryCreator({ viewmodel }: Readonly<{ viewmodel: ProductCategoryModel }>) {
  return (
    <section className="productcategorycreator" aria-label="新增商品分类">
      <div className="productcategorycreatorhead">
        <div>
          <strong>新增商品分类</strong>
          <p>创建成功后会自动选中，可继续保存商品。</p>
        </div>
        <Button tone="quiet" onPress={viewmodel.closeCreate} isDisabled={viewmodel.creating}>收起</Button>
      </div>
      <label>
        分类名称
        <input value={viewmodel.name} onChange={(event) => viewmodel.setName(event.target.value)} maxLength={255} required autoFocus placeholder="例如：节日礼赠" />
      </label>
      <label>
        上级分类（可选）
        <select value={viewmodel.parent} onChange={(event) => viewmodel.setParent(event.target.value)}>
          <option value="">作为一级分类</option>
          {viewmodel.categories.filter(({ status }) => status === 'active').map((category) => (
            <option key={category.id} value={category.id}>{categoryLabel(category)}</option>
          ))}
        </select>
      </label>
      {viewmodel.createError === undefined ? null : <p className="productflowerror" role="alert">{viewmodel.createError}</p>}
      <div className="productcategorycreatoractions">
        <Button onPress={viewmodel.closeCreate} isDisabled={viewmodel.creating}>取消</Button>
        <Button tone="primary" onPress={viewmodel.create} isDisabled={viewmodel.creating || viewmodel.name.trim() === ''}>
          {viewmodel.creating ? '正在创建…' : '创建并选中'}
        </Button>
      </div>
    </section>
  );
}

function categoryLabel(category: ProductCategoryModel['categories'][number]): string {
  const trail = category.parent_name === null ? category.name : `${category.parent_name} / ${category.name}`;
  return category.status === 'active' ? trail : `${trail}（已停用，请重新选择）`;
}
