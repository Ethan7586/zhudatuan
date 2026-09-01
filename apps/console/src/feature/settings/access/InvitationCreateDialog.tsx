import { Button, Dialog } from '@shop/design';
import type { ConsoleScopeKind } from '@shop/authz';
import { useEffect, useMemo, useState } from 'react';
import type { AccessMembership } from './AccessSchema';
import type { CreateInvitationInput } from './AccessQuery';
import { scopeText } from './PermissionText';

export function InvitationCreateDialog({
  open,
  memberships,
  scope,
  scopeKind,
  busy,
  error,
  onClose,
  onSubmit,
}: Readonly<{
  open: boolean;
  memberships: readonly AccessMembership[];
  scope: string;
  scopeKind: ConsoleScopeKind;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (input: CreateInvitationInput) => Promise<void>;
}>) {
  const [kind, setKind] = useState<CreateInvitationInput['kind']>('signin');
  const [target, setTarget] = useState<CreateInvitationInput['target']>('console');
  const [membership, setMembership] = useState('');
  const [recipient, setRecipient] = useState('');
  const [reason, setReason] = useState('');
  const [maxUses, setMaxUses] = useState(100);
  const [expires, setExpires] = useState(() => tomorrow(7));
  const eligible = useMemo(() => memberships.filter((item) => (item.client === 'storefront' ? 'storefront' : 'console') === target), [memberships, target]);
  const selected = eligible.find((item) => item.id === membership);
  useEffect(() => {
    if (!eligible.some((item) => item.id === membership)) setMembership(eligible[0]?.id ?? '');
  }, [eligible, membership]);
  useEffect(() => {
    if (kind === 'campaign') setTarget('storefront');
  }, [kind]);
  useEffect(() => {
    if (scopeKind !== 'mall' && kind === 'campaign') setKind('signin');
  }, [kind, scopeKind]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      kind,
      target,
      expiresAt: new Date(expires).toISOString(),
      reason: reason.trim(),
      ...(kind === 'campaign' ? { organizationId: scope, maxUses } : { membershipId: membership }),
      ...(recipient.trim() === '' ? {} : { recipient: recipient.trim() }),
    });
  };
  return (
    <Dialog open={open} title="签发邀请" eyebrow="一次性安全凭据" onClose={onClose} dismissable={!busy}>
      <form className="invitationform" onSubmit={(event) => void submit(event)}>
        <label>
          类型
          <select value={kind} onChange={(event) => setKind(event.target.value as CreateInvitationInput['kind'])} disabled={busy}>
            <option value="signin">登录邀请</option>
            <option value="enrollment">入驻邀请</option>
            {scopeKind === 'mall' ? <option value="campaign">活动邀请</option> : null}
          </select>
        </label>
        <label>
          Target
          <select value={target} onChange={(event) => setTarget(event.target.value as CreateInvitationInput['target'])} disabled={busy || kind === 'campaign'}>
            <option value="console">console</option>
            <option value="storefront">storefront</option>
          </select>
        </label>
        {kind === 'campaign' ? (
          <p className="invitationpreview">活动将绑定当前组织：{scope}</p>
        ) : (
          <label>
            精确 Membership
            <select value={membership} onChange={(event) => setMembership(event.target.value)} disabled={busy} required>
              {eligible.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          接收人（手机号或邮箱）
          <input value={recipient} onChange={(event) => setRecipient(event.target.value)} autoComplete="off" maxLength={200} disabled={busy} required={kind !== 'campaign'} />
        </label>
        {kind === 'campaign' ? (
          <label>
            使用上限
            <input type="number" min={1} max={10000} value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))} disabled={busy} />
          </label>
        ) : null}
        <label>
          失效时间
          <input type="datetime-local" value={expires} onChange={(event) => setExpires(event.target.value)} disabled={busy} required />
        </label>
        <label>
          签发原因
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={4} maxLength={1000} disabled={busy} required />
        </label>
        {selected === undefined || kind === 'campaign' ? null : (
          <section className="invitationpreview" aria-label="授权预览">
            <strong>授权预览</strong>
            <span>角色：{selected.roles.map((role) => role.name).join('、') || '无'}</span>
            <span>授权范围：{selected.scopes.map((grant) => `${grant.effect === 'allow' ? '允许' : '拒绝'}：${scopeText(grant.kind)}：${grant.scope}`).join('；') || '无'}</span>
          </section>
        )}
        <p className="invitationwarning">邀请码只显示一次；不得用于所有者授权，最终权限以服务端生成的授权计划为准。</p>
        {error === undefined ? null : <p role="alert">{error}</p>}
        <div className="invitationactions">
          <Button onPress={onClose} isDisabled={busy}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={busy || reason.trim().length < 4 || (kind !== 'campaign' && !membership)}>
            {busy ? '签发中…' : '确认签发'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function tomorrow(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
