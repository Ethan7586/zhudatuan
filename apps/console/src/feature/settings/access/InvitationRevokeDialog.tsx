import { Button, Dialog } from '@shop/design';
import { useEffect, useRef, useState } from 'react';
import type { Invitation } from './AccessSchema';

export function InvitationRevokeDialog({ invitation, busy, error, onClose, onSubmit }: Readonly<{ invitation: Invitation | undefined; busy: boolean; error?: string; onClose: () => void; onSubmit: (reason: string) => Promise<void> }>) {
  const [reason, setReason] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (invitation !== undefined) input.current?.focus();
  }, [invitation]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit(reason.trim());
  };
  return (
    <Dialog open={invitation !== undefined} title="撤销邀请" {...(invitation === undefined ? {} : { eyebrow: invitation.id })} onClose={onClose} dismissable={!busy}>
      <form className="invitationform" onSubmit={(event) => void submit(event)}>
        <p>撤销后该邀请码立即失效，操作不能静默覆盖版本冲突。</p>
        <label>
          撤销原因
          <textarea ref={input} value={reason} onChange={(event) => setReason(event.target.value)} minLength={4} maxLength={1000} disabled={busy} required />
        </label>
        {error === undefined ? null : <p role="alert">{error}</p>}
        <div className="invitationactions">
          <Button onPress={onClose} isDisabled={busy}>
            取消
          </Button>
          <Button type="submit" tone="danger" isDisabled={busy || reason.trim().length < 4}>
            {busy ? '撤销中…' : '确认撤销'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
