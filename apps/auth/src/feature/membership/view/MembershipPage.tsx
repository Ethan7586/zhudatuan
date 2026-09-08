import type { FailureView } from '@shop/presentation';
import type { Membership } from '../model/Membership';
import { AuthCard } from '../../../shell/AuthCard';
import { AuthShell } from '../../../shell/AuthShell';
import { Alert } from '../../../shared/view/Alert';
import { Loading } from '../../../shared/view/Loading';
import { MembershipList } from './MembershipList';

export function MembershipPage({ memberships, busy, failure, onSelect, onRestart }: Readonly<{ memberships: readonly Membership[]; busy: boolean; failure?: FailureView; onSelect: (membership: Membership) => void; onRestart: () => void }>) {
  return (
    <AuthShell>
      <AuthCard stage={2} onBack={onRestart}>
        <section className="authpanel">
          <header>
            <h1>选择你的工作台</h1>
            <p>仅展示本次登录目标下仍然有效的企业身份。</p>
          </header>
          {failure ? <Alert failure={failure} onAction={onRestart} /> : null}
          {busy && memberships.length === 0 ? <Loading label="正在核验可用身份…" /> : null}
          {!failure && memberships.length > 0 ? <MembershipList memberships={memberships} busy={busy} onSelect={onSelect} /> : null}
          {!failure && !busy && memberships.length === 0 ? <div className="authempty">该账号当前没有可用身份，请联系企业管理员。</div> : null}
        </section>
      </AuthCard>
    </AuthShell>
  );
}
