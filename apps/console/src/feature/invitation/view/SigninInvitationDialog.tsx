import { Button, Dialog, Form } from '@shop/design';
import { useEffect, useMemo, useState } from 'react';
import type { InvitationMembershipPage } from '../model/Invitation';
import type { InvitationDraft } from '../model/InvitationDraft';
import { OPERATION_TARGETS, type OperationTarget } from '@shop/contract';
import { invitationTarget } from '../viewmodel/InvitationText';

export function SigninInvitationDialog({
  open,
  memberships,
  busy,
  error,
  onClose,
  onSubmit,
}: Readonly<{ open: boolean; memberships: InvitationMembershipPage['items']; busy: boolean; error?: string; onClose: () => void; onSubmit: (draft: InvitationDraft) => Promise<void> }>) {
  const [target, setTarget] = useState<OperationTarget>('console');
  const eligible = useMemo(() => memberships.filter((item) => item.client === target && item.status === 'active'), [memberships, target]);
  const [membership, setMembership] = useState('');
  const [expiresAt, setExpiresAt] = useState(() => new Date(Date.now() + 72 * 3_600_000).toISOString());
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!eligible.some((item) => item.id === membership)) setMembership(eligible[0]?.id ?? '');
  }, [eligible, membership]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({ kind: 'signin', target, membershipId: membership, expiresAt, reason: reason.trim() });
  };
  return (
    <Dialog open={open} title="创建登录邀请" eyebrow="高风险操作 · 指定成员" onClose={onClose} dismissable={!busy}>
      <Form label="登录邀请" className="invitationform" onSubmit={(event) => void submit(event)}>
        {error === undefined ? null : (
          <p className="invitationerror" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="signinTarget">登录位置</label>
        <select id="signinTarget" value={target} onChange={(event) => setTarget(event.target.value as typeof target)} disabled={busy}>
          {OPERATION_TARGETS.map((value) => (
            <option key={value} value={value}>
              {invitationTarget(value)}
            </option>
          ))}
        </select>
        <label htmlFor="signinMembership">指定成员</label>
        <select id="signinMembership" value={membership} onChange={(event) => setMembership(event.target.value)} disabled={busy} required>
          {eligible.length === 0 ? <option value="">该位置暂无可邀请的在职成员</option> : null}
          {eligible.map((item) => (
            <option key={item.id} value={item.id}>
              {membershipLabel(item)}
            </option>
          ))}
        </select>
        <label htmlFor="signinExpires">有效期</label>
        <input id="signinExpires" type="datetime-local" value={localTime(expiresAt)} onChange={(event) => setExpiresAt(new Date(event.target.value).toISOString())} disabled={busy} />
        <label htmlFor="signinReason">邀请原因</label>
        <textarea id="signinReason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={4} maxLength={500} disabled={busy} required />
        <footer className="invitationactions">
          <Button onPress={onClose} isDisabled={busy}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={busy || membership === '' || reason.trim().length < 4}>
            {busy ? '正在创建…' : '确认创建'}
          </Button>
        </footer>
      </Form>
    </Dialog>
  );
}

function membershipLabel(item: InvitationMembershipPage['items'][number]): string {
  const detail = item.employeeNo ? `工号 ${item.employeeNo}` : item.mobileMasked ? `手机 ${item.mobileMasked}` : undefined;
  return detail ? `${item.displayName} · ${detail}` : item.displayName;
}

function localTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
