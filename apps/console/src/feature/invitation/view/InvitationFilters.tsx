import type { InvitationViewModel } from '../viewmodel/InvitationViewModel';

export function InvitationFilters({ model }: Readonly<{ model: InvitationViewModel }>) {
  return (
    <section className="invitationfilters" aria-label="筛选邀请记录">
      <span>筛选记录</span>
      <label>
        使用位置
        <select value={model.filter.target ?? ''} onChange={(event) => model.actions.updateFilter('target', event.target.value)}>
          <option value="">全部位置</option>
          <option value="storefront">消费者商城</option>
          <option value="console">运营控制台</option>
        </select>
      </label>
      <label>
        邀请场景
        <select value={model.filter.kind ?? ''} onChange={(event) => model.actions.updateFilter('kind', event.target.value)}>
          <option value="">全部场景</option>
          <option value="enrollment">指定员工注册</option>
          <option value="campaign">共享员工注册</option>
          <option value="signin">指定成员安全访问</option>
        </select>
      </label>
      <label>
        当前状态
        <select value={model.filter.status ?? ''} onChange={(event) => model.actions.updateFilter('status', event.target.value)}>
          <option value="">全部状态</option>
          <option value="active">等待接收</option>
          <option value="exhausted">已完成</option>
          <option value="revoked">已撤销</option>
          <option value="expired">已过期</option>
        </select>
      </label>
    </section>
  );
}
