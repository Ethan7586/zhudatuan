import { Button } from '@shop/design';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';

export function TaskNavigation({ model }: Readonly<{ model: AccessViewModel }>) {
  const tasks = [
    { id: 'members' as const, title: '成员与权限', detail: '查看每位成员能做什么', count: `${model.page?.count ?? 0} 位` },
    { id: 'roles' as const, title: '岗位角色', detail: '按岗位批量配置权限', count: `${model.page?.roles.length ?? 0} 个` },
    { id: 'scopes' as const, title: '项目范围', detail: '限定可管理的商城与门店', count: `${model.page?.items.reduce((sum, item) => sum + item.scopes.length, 0) ?? 0} 项` },
    { id: 'ownership' as const, title: '所有权转移', detail: '安全交接最高管理权限', count: model.ownership?.pending?.state === 'pending' ? '1 项待办' : '无待办' },
  ];
  return (
    <nav className="accesstasks" aria-label="权限中心任务">
      {tasks.map((task) => (
        <button type="button" key={task.id} aria-current={model.task === task.id ? 'page' : undefined} onClick={() => model.actions.task(task.id)}>
          <span>
            <strong>{task.title}</strong>
            <small>{task.detail}</small>
          </span>
          <b>{task.count}</b>
        </button>
      ))}
    </nav>
  );
}

export function OwnershipCard({ model }: Readonly<{ model: AccessViewModel }>) {
  const ownership = model.ownership;
  if (!ownership) return null;
  const pending = ownership.pending;
  return (
    <section className="accessownership" aria-label="所有权状态">
      <div>
        <span>当前所有者</span>
        <strong>{ownership.owner.displayName}</strong>
        <small>
          所有权第 {ownership.version} 版{ownership.mobileReady ? ' · 已具备手机验证条件' : ' · 尚未具备手机验证条件'}
        </small>
      </div>
      {pending ? (
        <div className="accesspending">
          <span>待接受申请</span>
          <strong>新所有者：{pending.targetDisplayName}</strong>
          <small>
            {pending.state === 'expired' ? '申请已过期，请刷新后重新发起' : model.coolingRemaining > 0 ? `24 小时冷静期剩余 ${formatDuration(model.coolingRemaining)}` : '冷静期已结束，可由新所有者接受'}
            {' · '}有效期至 {new Date(pending.expiresAt).toLocaleString('zh-CN')} · 第 {pending.version} 版
          </small>
        </div>
      ) : (
        <div className="accessownershipempty">
          <strong>没有待处理的交接申请</strong>
          <small>需要更换最高管理员时，可在这里发起交接。</small>
        </div>
      )}
      <div className="accessactions">
        {!pending && model.capabilities.owner ? (
          <Button tone="danger" onPress={model.actions.owner}>
            发起所有权转移
          </Button>
        ) : null}
        {model.capabilities.ownerAccept ? (
          <Button tone="danger" onPress={model.actions.ownerAccept}>
            审核并接受
          </Button>
        ) : null}
        {model.capabilities.ownerCancel ? <Button onPress={model.actions.ownerCancel}>取消申请</Button> : null}
      </div>
    </section>
  );
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`;
}
