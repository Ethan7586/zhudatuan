import { AlertCircle } from 'lucide-react';
import { AuthCard } from '../../../shell/AuthCard';
import { AuthShell } from '../../../shell/AuthShell';
import { LINK_GUIDANCE } from '../model/Link';

export function LinkPage({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <AuthShell><AuthCard stage={2} onBack={onBack}><section className="authstatus">
        <AlertCircle className="authstatusicon authstatuswarning" />
        <h1>{LINK_GUIDANCE.title}</h1>
        <p>{LINK_GUIDANCE.detail}</p>
      </section></AuthCard></AuthShell>
  );
}
