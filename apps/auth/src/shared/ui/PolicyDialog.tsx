import { Button, Dialog } from '@shop/design';
import type { RegistrationPolicy } from '../../feature/invitation/model/RegistrationPolicy';

export function PolicyDialog({ policy, kind, onAccept, onClose }: Readonly<{ policy: RegistrationPolicy; kind?: 'terms' | 'privacy'; onAccept: () => void; onClose: () => void }>) {
  const title = kind === 'terms' ? policy.termsTitle : policy.privacyTitle;
  const body = kind === 'terms' ? policy.termsBody : policy.privacyBody;
  return (
    <Dialog open={kind !== undefined} title={title} eyebrow="认证政策" onClose={onClose}>
      <div className="authpolicy">
        <div>{body}</div>
        <Button tone="primary" onPress={onAccept}>
          我已阅读并同意
        </Button>
      </div>
    </Dialog>
  );
}
