import { Button, Dialog, Form } from '@shop/design';
import { useState } from 'react';
import type { InvitationDraft } from '../model/InvitationDraft';

export function CampaignInvitationDialog({ open, scope, busy, error, onClose, onSubmit }: Readonly<{ open: boolean; scope: string; busy: boolean; error?: string; onClose: () => void; onSubmit: (draft: InvitationDraft) => Promise<void> }>) {
  const [maxUses, setMaxUses] = useState(100);
  const [expiresAt, setExpiresAt] = useState(() => new Date(Date.now() + 3 * 86_400_000).toISOString());
  const [reason, setReason] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({ kind: 'campaign', target: 'storefront', organizationId: scope, maxUses, expiresAt, reason: reason.trim() });
  };
  return (
    <Dialog open={open} title="创建共享注册邀请" eyebrow="高风险操作 · 仅员工商城" onClose={onClose} dismissable={!busy}>
      <Form label="共享注册邀请" className="invitationform" onSubmit={(event) => void submit(event)}>
        <p className="invitationwarning">共享邀请码可被多人使用，需要高强度二次验证。请仅在受控活动中发放。</p>
        {error === undefined ? null : <p className="invitationerror" role="alert">{error}</p>}
        <label htmlFor="campaignUses">最多使用次数</label>
        <input id="campaignUses" type="number" min={1} max={10000} value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))} disabled={busy} />
        <label htmlFor="campaignExpires">有效期</label>
        <input id="campaignExpires" type="datetime-local" value={localTime(expiresAt)} onChange={(event) => setExpiresAt(new Date(event.target.value).toISOString())} disabled={busy} />
        <label htmlFor="campaignReason">邀请原因</label>
        <textarea id="campaignReason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={4} maxLength={500} disabled={busy} required />
        <footer className="invitationactions"><Button onPress={onClose} isDisabled={busy}>取消</Button><Button type="submit" tone="primary" isDisabled={busy || reason.trim().length < 4}>{busy ? '正在创建…' : '确认创建'}</Button></footer>
      </Form>
    </Dialog>
  );
}

function localTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
