import type { FormEvent } from 'react';
import type { ProductAction } from '../model/ProductAction';
import type { ProductActionViewModel } from '../viewmodel/ProductActionViewModel';

export function ProductDialog({ viewmodel, onClose }: Readonly<{ viewmodel: ProductActionViewModel; onClose: () => void }>) {
  const action = viewmodel.action;
  if (action === null) return null;
  const submit = (event: FormEvent) => { event.preventDefault(); viewmodel.submit(); };
  return <div className="productflowoverlay"><button className="productflowbackdrop" type="button" onClick={onClose} aria-label="关闭商品操作窗口" /><form className="productflowdialog" aria-label={actionTitle(action.kind)} onSubmit={submit}>
    <header><div><p>商品操作</p><h2>{actionTitle(action.kind)}</h2></div><button type="button" onClick={onClose} aria-label="关闭商品操作窗口">×</button></header>
    <div className="productflowbody">
      {action.kind === 'create' || action.kind === 'edit' ? <>
        <label>商品名称<input value={viewmodel.title} onChange={(event) => viewmodel.setTitle(event.target.value)} required maxLength={160} /></label>
        <label>商品分类<input value={viewmodel.category} onChange={(event) => viewmodel.setCategory(event.target.value)} required maxLength={120} /></label>
        {action.kind === 'create' ? <label>商品类型<select value={viewmodel.type} onChange={(event) => viewmodel.setType(event.target.value as ProductActionViewModel['type'])}><option value="physical">实物商品</option><option value="virtual">虚拟商品</option><option value="service">服务商品</option><option value="voucher">卡券商品</option></select></label> : null}
        {action.kind === 'edit' ? <label>商品状态<select value={viewmodel.status} onChange={(event) => viewmodel.setStatus(event.target.value as ProductActionViewModel['status'])}><option value="draft">草稿</option><option value="review">待审核</option><option value="active">启用</option><option value="archived">归档</option></select></label> : null}
      </> : null}
      {action.kind === 'price' ? <label>销售价（元）<input type="number" min="0.01" max="999999.99" step="0.01" value={viewmodel.amount} onChange={(event) => viewmodel.setAmount(event.target.value)} required /></label> : null}
      <ProductActionMessage action={action} />
      {viewmodel.error === undefined ? null : <p role="alert" className="productflowerror">{viewmodel.error}</p>}
    </div>
    <footer><button type="button" onClick={onClose}>取消</button><button className="productactionprimary" type="submit" disabled={viewmodel.submitting}>{viewmodel.submitting ? '正在提交…' : actionSubmit(action.kind)}</button></footer>
  </form></div>;
}

function ProductActionMessage({ action }: Readonly<{ action: ProductAction }>) {
  if (action.kind === 'archive') return <p>归档商品“{action.listing.title}”后将不可继续销售；历史订单保持不变。</p>;
  if (action.kind === 'publish' || action.kind === 'unpublish') return <p>确认{action.kind === 'publish' ? '上架' : '下架'}“{action.listing.title}”？该操作使用当前列表版本进行并发校验。</p>;
  if (action.kind === 'create') return <p className="productflownote">商品先以草稿创建；商品规格与商品池投放由后续独立流程完成。</p>;
  return null;
}

function actionTitle(kind: ProductAction['kind']): string { return { create: '新建商品', edit: '编辑商品', archive: '归档商品', price: '设置销售价', publish: '上架商品', unpublish: '下架商品' }[kind]; }
function actionSubmit(kind: ProductAction['kind']): string { return { create: '创建草稿', edit: '保存修改', archive: '确认归档', price: '创建并发布价格', publish: '确认上架', unpublish: '确认下架' }[kind]; }
