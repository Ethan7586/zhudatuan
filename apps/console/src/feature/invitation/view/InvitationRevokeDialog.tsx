import { Button, Dialog, Form } from '@shop/design';
import { useEffect, useRef, useState } from 'react';
import type { Invitation } from '../model/Invitation';
import { invitationKind } from '../viewmodel/InvitationText';

export function InvitationRevokeDialog({ invitation, busy, error, onClose, onSubmit }: Readonly<{ invitation?: Invitation; busy: boolean; error?: string; onClose: () => void; onSubmit: (reason: string) => Promise<void> }>) {
  const [reason, setReason] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (invitation) {
      setReason('');
      field.current?.focus();
    }
  }, [invitation]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit(reason.trim());
  };
  return (
    <Dialog open={invitation !== undefined} title="撤销邀请" {...(invitation === undefined ? {} : { eyebrow: invitationContext(invitation) })} onClose={onClose} dismissable={!busy}>
      <Form label="撤销邀请" className="invitationform" onSubmit={(event) => void submit(event)}>
        <p className="invitationwarning">撤销提交后立即生效，正在进行的注册会在事务校验时被拒绝。</p>
        {error === undefined ? null : (
          <p className="invitationerror" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="revokeReason">撤销原因</label>
        <textarea ref={field} id="revokeReason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={4} maxLength={500} disabled={busy} required />
        <footer className="invitationactions">
          <Button onPress={onClose} isDisabled={busy}>
            取消
          </Button>
          <Button type="submit" tone="danger" isDisabled={busy || reason.trim().length < 4}>
            {busy ? '正在撤销…' : '确认撤销'}
          </Button>
        </footer>
      </Form>
    </Dialog>
  );
}

function invitationContext(invitation: Invitation): string {
  const recipient = invitation.recipientDisplayName ?? (invitation.kind === 'campaign' ? '多人共享注册' : invitation.kind === 'signin' ? '已有成员' : '待注册员工');
  return `${invitationKind(invitation.kind)} · ${recipient}`;
}
