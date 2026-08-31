import { Button } from '@shop/design';
import { useEffect, useState } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import {
  capabilitiesReady,
  formatDate,
  formatDuration,
  formerOwnerLabel,
} from './OwnerTransferModel';
import type { OwnershipState } from './OwnerTransferSchema';

export function OwnerState({ ownership, context, isOwner, isTarget, notice, onCreate, onAccept, onCancel }: Readonly<{
  ownership: OwnershipState;
  context: ConsoleContext;
  isOwner: boolean;
  isTarget: boolean;
  notice?: string | undefined;
  onCreate: () => void;
  onAccept: () => void;
  onCancel: () => void;
}>) {
  if (ownership.state === 'bootstrap_pending' || ownership.owner === null) {
    return <Boundary title="首任 Owner 尚未建立" message="首任 Owner 只能通过受审计的初始化迁移建立；Console 不提供绕过唯一席位约束的自助入口。" danger />;
  }
  const pending = ownership.pending;
  const pendingActive = pending?.state === 'pending_acceptance';
  const now = useOwnershipClock(pendingActive);
  const coolingUntil = pending === null ? Number.NaN : new Date(pending.coolingUntil).getTime();
  const expiresAt = pending === null ? Number.NaN : new Date(pending.expiresAt).getTime();
  const cooling = pendingActive && (!Number.isFinite(coolingUntil) || coolingUntil > now);
  const expired = pending !== null && (!Number.isFinite(expiresAt) || expiresAt <= now);
  const createCapabilities = capabilitiesReady(context.session, 'create');
  const acceptCapabilities = capabilitiesReady(context.session, 'accept');
  const cancelCapabilities = capabilitiesReady(context.session, 'cancel');
  const readyCandidates = ownership.candidates.filter(({ mobileReady }) => mobileReady);
  return <div className="ownertransferbody">
    {notice === undefined ? null : <p className="ownertransfernotice" role="status">{notice}</p>}
    <div className="ownertransfergrid">
      <article className="ownercard ownercardcurrent"><span>当前唯一 Owner</span><strong>{ownership.owner.displayName}</strong>
        <small>{ownership.owner.membership}</small><dl><div><dt>Ownership Version</dt><dd>{ownership.version}</dd></div>
          <div><dt>当前会话</dt><dd>{isOwner ? 'Owner 本人' : '非 Owner'}</dd></div></dl></article>
      <article className="ownercard"><span>转让状态</span><strong>{pending === null ? '未发起转让' : '等待接任人确认'}</strong>
        <small>{pending === null ? 'Owner 席位稳定' : `截止 ${formatDate(pending.expiresAt)}`}</small>
        {pending === null ? <p>转让不会删除任何人的商城身份；只交换唯一 Owner 席位。</p>
          : <p>接任人：{pending.targetDisplayName}<br />旧 Owner：{formerOwnerLabel(pending.formerOwnerMode)}<br />
            {cooling ? `冷静期剩余：${formatDuration(coolingUntil - now)}` : '冷静期已结束'}<br />
            申请到期：{formatDate(pending.expiresAt)}</p>}</article>
    </div>
    {pending === null && isOwner ? <div className="ownertransferactions"><Button tone="danger" onPress={onCreate}
      isDisabled={!createCapabilities || readyCandidates.length === 0}>发起 Owner 转让</Button></div> : null}
    {pending !== null && isTarget ? <div className="ownertransferactions"><Button tone="primary" onPress={onAccept}
      isDisabled={!acceptCapabilities || !pendingActive || cooling || expired}>本人确认接任 Owner</Button></div> : null}
    {pending !== null && isOwner ? <div className="ownertransferactions"><Button tone="danger" onPress={onCancel}
      isDisabled={!cancelCapabilities || !pendingActive || expired}>取消待确认转让</Button></div> : null}
    {pendingActive && isTarget && cooling ? <Boundary title="24 小时冷静期内" message={`还需等待 ${formatDuration(coolingUntil - now)}；冷静期结束后才能完成本人 Step-Up 与接任。`} /> : null}
    {pending !== null && expired ? <Boundary title="转让已到期" message="本次转让超过 7 天有效期，不能接受或取消；请刷新权威状态。" danger /> : null}
    {(isOwner || isTarget) && !ownership.mobileReady ? <Boundary title="当前账户尚未绑定 Canonical 安全手机号"
      message="打开本人可执行的 Owner 操作后，先验证当前密码并完成新手机号 OTP；绑定成功必须重新登录，之后才能发送 Step-Up。" danger /> : null}
    {pending === null && isOwner && readyCandidates.length === 0
      ? <Boundary title="没有合格接任人" message={ownership.candidates.length === 0
        ? '接任人必须是当前平台内有效的管理员；无需清空原有管理员身份。'
        : '现有管理员尚未完成 Canonical 安全手机号绑定，不能成为接任目标。请其先在身份安全入口完成首次绑定。'} /> : null}
    {isOwner && !createCapabilities ? <Boundary title="发起能力不完整" message="缺少转让、短信 Step-Up 或 action proof 对应 capability，危险按钮保持关闭。" danger /> : null}
    {isTarget && !acceptCapabilities ? <Boundary title="接任能力不完整" message="缺少接受转让或短信 Step-Up capability，不能提交接任。" danger /> : null}
  </div>;
}

export function Boundary({ title, message, danger = false }: Readonly<{ title: string; message: string; danger?: boolean }>) {
  return <section className={`ownertransferboundary${danger ? ' ownertransferboundarydanger' : ''}`} role={danger ? 'alert' : 'note'}>
    <strong>{title}</strong><p>{message}</p></section>;
}

function useOwnershipClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}
