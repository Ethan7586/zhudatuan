import { lazy, useState } from 'react';
import { Button } from '@shop/design';
import type { RegistrationPolicy } from '../../feature/enrollment';

const PolicyDialog = lazy(() => import('./PolicyDialog').then((module) => ({ default: module.PolicyDialog })));

export function LegalAgreement({
  policy,
  accepted,
  busy,
  error,
  onAccepted,
}: Readonly<{
  policy: RegistrationPolicy;
  accepted: boolean;
  busy: boolean;
  error?: string;
  onAccepted: (accepted: boolean) => void;
}>) {
  const [open, setOpen] = useState<'terms' | 'privacy'>();
  return (
    <>
      <label className="authagreement">
        <input type="checkbox" checked={accepted} disabled={busy} onChange={(event) => onAccepted(event.target.checked)} />
        <span>
          我已阅读并同意
          <Button tone="quiet" className="authinline" onPress={() => setOpen('terms')}>
            《{policy.termsTitle}》
          </Button>
          和
          <Button tone="quiet" className="authinline" onPress={() => setOpen('privacy')}>
            《{policy.privacyTitle}》
          </Button>
        </span>
      </label>
      {error ? (
        <p className="authfieldissue" role="alert">
          {error}
        </p>
      ) : null}
      {open === undefined ? null : (
        <PolicyDialog
          policy={policy}
          kind={open}
          onClose={() => setOpen(undefined)}
          onAccept={() => {
            onAccepted(true);
            setOpen(undefined);
          }}
        />
      )}
    </>
  );
}
