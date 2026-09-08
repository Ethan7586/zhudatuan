import { Button } from '@shop/design';
import { FileText, ShieldCheck } from 'lucide-react';
import { lazy, useId, useState } from 'react';
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
  const controlId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const describedBy = error ? `${descriptionId} ${errorId}` : descriptionId;
  return (
    <>
      <section className="authagreement" data-accepted={accepted} data-invalid={Boolean(error)} aria-labelledby={titleId}>
        <label className="authagreementcheck" htmlFor={controlId} aria-label="同意服务协议与隐私政策">
          <input
            id={controlId}
            className="authagreementinput"
            type="checkbox"
            checked={accepted}
            disabled={busy}
            aria-labelledby={titleId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-errormessage={error ? errorId : undefined}
            onChange={(event) => onAccepted(event.target.checked)}
          />
          <span className="authagreementcopy">
            <strong id={titleId}>我已阅读并同意</strong>
            <small id={descriptionId}>继续前请确认以下服务协议与隐私政策。</small>
          </span>
        </label>
        <div className="authpolicyactions" aria-label="相关协议">
          <span>相关协议</span>
          <Button type="button" tone="quiet" className="authpolicybutton" onPress={() => setOpen('terms')}>
            <FileText aria-hidden="true" />
            {policy.termsTitle}
          </Button>
          <Button type="button" tone="quiet" className="authpolicybutton" onPress={() => setOpen('privacy')}>
            <ShieldCheck aria-hidden="true" />
            {policy.privacyTitle}
          </Button>
        </div>
      </section>
      {error ? (
        <p id={errorId} className="authfieldissue" role="alert">
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
