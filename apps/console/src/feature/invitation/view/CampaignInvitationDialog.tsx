import { Button, Dialog, Form } from '@shop/design';
import { useEffect, useState } from 'react';
import { campaignInvitation, type InvitationDraft } from '../model/InvitationDraft';
import type { InvitationTarget } from '../model/InvitationTarget';

export function CampaignInvitationDialog({
  open,
  targets,
  busy,
  error,
  onClose,
  onSubmit,
}: Readonly<{ open: boolean; targets: readonly InvitationTarget[]; busy: boolean; error?: string; onClose: () => void; onSubmit: (draft: InvitationDraft) => Promise<void> }>) {
  const [organizationId, setOrganizationId] = useState(() => (targets.length === 1 ? targets[0]!.id : ''));
  const [maxUses, setMaxUses] = useState(100);
  const [expiresAt, setExpiresAt] = useState(() => new Date(Date.now() + 3 * 86_400_000).toISOString());
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open && !targets.some(({ id }) => id === organizationId)) setOrganizationId(targets.length === 1 ? targets[0]!.id : '');
  }, [open, organizationId, targets]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (organizationId === '') return;
    await onSubmit(campaignInvitation({ organizationId, maxUses, expiresAt, reason }));
  };
  return (
    <Dialog open={open} title="创建共享注册邀请" eyebrow="高风险操作 · 仅员工商城" onClose={onClose} dismissable={!busy}>
      <Form label="共享注册邀请" className="invitationform" onSubmit={(event) => void submit(event)}>
        <p className="invitationwarning">共享邀请码可被多人使用，需要高强度二次验证。请仅在受控活动中发放。</p>
        {error === undefined ? null : (
          <p className="invitationerror" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="campaignOrganization">适用商城</label>
        <select id="campaignOrganization" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} disabled={busy} required>
          <option value="">请选择共享邀请适用的商城</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
            </option>
          ))}
        </select>
        <label htmlFor="campaignUses">最多使用次数</label>
        <input id="campaignUses" type="number" min={1} max={10000} value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))} disabled={busy} />
        <label htmlFor="campaignExpires">有效期</label>
        <input id="campaignExpires" type="datetime-local" value={localTime(expiresAt)} onChange={(event) => setExpiresAt(new Date(event.target.value).toISOString())} disabled={busy} />
        <label htmlFor="campaignReason">邀请原因</label>
        <textarea id="campaignReason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={4} maxLength={500} disabled={busy} required />
        <footer className="invitationactions">
          <Button onPress={onClose} isDisabled={busy}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={busy || organizationId === '' || reason.trim().length < 4}>
            {busy ? '正在创建…' : '确认创建'}
          </Button>
        </footer>
      </Form>
    </Dialog>
  );
}

function localTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
