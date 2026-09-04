import { Button } from '@shop/design';
import type { CustomerKind, CustomerStatus } from '../model/Customer';
import type { CustomerViewModel } from '../viewmodel/CustomerViewModel';

export function CustomerFilters({ model }: Readonly<{ model: CustomerViewModel }>) {
  return (
    <form className="customerfilters" aria-label="客户筛选" onSubmit={(event) => { event.preventDefault(); model.actions.search(); }}>
      <label>搜索客户<input value={model.searchText} onChange={(event) => model.actions.searchText(event.target.value)} placeholder="名称或识别号" /></label>
      <label>客户类型<select value={model.query.kind ?? ''} onChange={(event) => model.actions.customerKind(event.target.value as CustomerKind | '')}><option value="">全部类型</option><option value="enterprise">企业</option><option value="institution">事业单位</option><option value="government">政府机构</option></select></label>
      <label>状态<select value={model.query.status ?? ''} onChange={(event) => model.actions.customerStatus(event.target.value as CustomerStatus | '')}><option value="">全部状态</option><option value="draft">待完善</option><option value="active">合作中</option><option value="disabled">已停用</option></select></label>
      <Button type="submit">查询</Button>
    </form>
  );
}
