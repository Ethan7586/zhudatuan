import { Button } from '@shop/design';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';
import { TechnicalDetails } from './TechnicalDetails';

export function TaskNavigation({ model }: Readonly<{ model: AccessViewModel }>) {
  const tasks = Object.freeze([
    Object.freeze({ id: 'members' as const, title: '成员与权限', detail: '查看每个人的岗位、权限和范围', count: `${model.page?.count ?? 0} 位` }),
    Object.freeze({ id: 'roles' as const, title: '岗位角色', detail: '把一组职责安全授予多人', count: `${model.page?.roles.length ?? 0} 个` }),
    Object.freeze({ id: 'scopes' as const, title: '项目范围', detail: '限定成员可管理的商城与门店', count: `${model.page?.items.reduce((sum, item) => sum + item.scopes.length, 0) ?? 0} 项` }),
  ]);
  const ownership = Object.freeze({ id: 'ownership' as const, title: '所有者转移', detail: '更换当前范围的最高管理员', count: model.ownership?.pending?.state === 'pending' ? '1 项待办' : '无待办' });
  return (
    <section className="accessnavigation" aria-labelledby="accessnavigationtitle">
      <header>
        <div>
          <span>常用任务</span>
          <h2 id="accessnavigationtitle">选择现在要完成的事情</h2>
        </div>
        <p>日常授权从成员开始；只有更换最高管理员时才进入所有者转移。</p>
      </header>
      <div className="accessnavigationlayout">
        <nav className="accesstasks" aria-label="权限中心任务">
          {tasks.map((task) => (
            <TaskButton key={task.id} task={task} current={model.task === task.id} onPress={() => model.actions.task(task.id)} />
          ))}
        </nav>
        <div className="accessownershiptask">
          <span>高风险操作</span>
          <TaskButton task={ownership} current={model.task === ownership.id} onPress={() => model.actions.task(ownership.id)} />
        </div>
      </div>
    </section>
  );
}

function TaskButton({ task, current, onPress }: Readonly<{ task: Readonly<{ title: string; detail: string; count: string }>; current: boolean; onPress: () => void }>) {
  return (
    <button className="accesstask" type="button" data-visual-copy="multiline" aria-current={current ? 'page' : undefined} onClick={onPress}>
      <span>
        <strong>{task.title}</strong>
        <small>{task.detail}</small>
      </span>
      <b>{task.count}</b>
    </button>
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
        <small>{ownership.mobileReady ? '已具备手机验证条件' : '尚未具备手机验证条件'}</small>
      </div>
      {pending ? (
        <div className="accesspending">
          <span>待接受申请</span>
          <strong>新所有者：{pending.targetDisplayName}</strong>
          <small>
            {pending.state === 'expired' ? '申请已过期，请刷新后重新发起' : model.coolingRemaining > 0 ? `24 小时冷静期剩余 ${formatDuration(model.coolingRemaining)}` : '冷静期已结束，可由新所有者接受'}
            {' · '}有效期至 {new Date(pending.expiresAt).toLocaleString('zh-CN')}
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
      <TechnicalDetails facts={[{ label: '所有权版本', value: `第 ${ownership.version} 版` }, ...(pending ? [{ label: '申请版本', value: `第 ${pending.version} 版` }] : [])]} />
    </section>
  );
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`;
}
