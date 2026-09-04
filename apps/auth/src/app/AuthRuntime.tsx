import { Button } from '@shop/design';
import { lazy, type ReactNode } from 'react';
import type { SessionRequest } from '../shared/security/ReturnTarget';
import type { Dependencies } from './Dependencies';
import { useLoginViewModel } from '../feature/login/viewmodel/LoginViewModel';
import { LoginPage } from '../feature/login/view/LoginPage';
import { MembershipList } from '../feature/membership/view/MembershipList';
import { InvitationProof } from '../feature/invitation/view/InvitationProof';
import { Loading } from '../shared/ui/Loading';
import { Alert } from '../shared/ui/Alert';
import { AuthCard } from '../shell/AuthCard';
import { AuthShell } from '../shell/AuthShell';
import { useRecoveryViewModel } from '../feature/recovery/viewmodel/RecoveryViewModel';
import { useEnrollmentViewModel } from '../feature/enrollment/viewmodel/EnrollmentViewModel';

const EnrollmentPage = lazy(() => import('../feature/enrollment/view/EnrollmentPage').then((module) => ({ default: module.EnrollmentPage })));
const RecoveryDialog = lazy(() => import('../feature/recovery/view/RecoveryDialog').then((module) => ({ default: module.RecoveryDialog })));

export function AuthRuntime({ dependencies, request, invitation, onTarget }: Readonly<{ dependencies: Dependencies; request: SessionRequest; invitation: boolean; onTarget: (target: SessionRequest['target']) => void }>) {
  const vm = useLoginViewModel(dependencies, request, invitation, onTarget);
  const state = vm.state;
  if (state.phase === 'bootstrapping')
    return (
      <Frame>
        <Loading label="正在初始化安全登录…" />
      </Frame>
    );
  if (state.phase === 'bootstrapfailure' || state.phase === 'terminalfailure')
    return (
      <Frame>
        <Alert failure={state.failure} onAction={vm.retry} />
      </Frame>
    );
  if (state.phase === 'cancelled')
    return (
      <Frame>
        <section className="authstatus">
          <h1>操作已取消</h1>
          <p>当前请求已安全停止，你可以重新开始登录。</p>
          <Button className="authfull" tone="primary" onPress={vm.restart}>
            重新开始
          </Button>
        </section>
      </Frame>
    );
  const stage =
    state.phase === 'membershipselection' ? (
      <MembershipList memberships={state.memberships} busy={vm.busy} onSelect={vm.select} />
    ) : state.phase === 'proof' ? (
      <InvitationProof busy={vm.busy} method={state.methodKind} {...(state.challenge ? { challenge: state.challenge } : {})} onSubmit={vm.proof} />
    ) : undefined;
  return (
    <>
      <LoginPage
        bootstrap={state.bootstrap}
        target={state.target}
        {...(vm.focusTarget === undefined ? {} : { focusTarget: vm.focusTarget })}
        method={state.method}
        accepted={state.accepted}
        busy={vm.busy}
        fields={vm.fields}
        providers={vm.providers}
        providersLoading={vm.providersLoading}
        {...(vm.pageFailure === undefined ? {} : { failure: vm.pageFailure })}
        {...(state.notice === undefined ? {} : { notice: state.notice })}
        {...(vm.providerFailure === undefined ? {} : { providerFailure: vm.providerFailure })}
        {...(stage === undefined ? {} : { stage })}
        {...(invitation && state.method === 'invitation' ? { invitationStep: invitationStep(state.phase) } : {})}
        onMethod={vm.method}
        onTarget={vm.changeTarget}
        onAccepted={vm.accepted}
        onPassword={vm.password}
        onOtp={vm.otp}
        onChallenge={vm.challenge}
        onInvitation={vm.resolveInvitation}
        onProvider={vm.provider}
        onProviderRetry={vm.retryProviders}
        onBack={vm.back}
        onReset={vm.openRecovery}
      />
      {state.phase === 'enrollment' ? <Enrollment enrollment={state.enrollment} passwordPolicy={state.bootstrap.password} createChallenge={vm.createEnrollmentChallenge} onComplete={vm.completeEnrollment} onClose={vm.back} /> : null}
      {vm.recovery ? <Recovery bootstrap={state.bootstrap} onChallenge={vm.recoveryChallenge} onReset={vm.resetPassword} onClose={vm.closeRecovery} /> : null}
    </>
  );
}

function invitationStep(phase: ReturnType<typeof useLoginViewModel>['state']['phase']): 1 | 2 | 3 | 4 {
  if (phase === 'enrollment') return 2;
  if (phase === 'proof' || phase === 'membershipselection') return 3;
  if (phase === 'exchangingticket' || phase === 'redirecting') return 4;
  return 1;
}

function Frame({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthShell>
      <AuthCard stage={1} onBack={() => undefined}>
        {children}
      </AuthCard>
    </AuthShell>
  );
}
function Enrollment({
  enrollment,
  passwordPolicy,
  createChallenge,
  onComplete,
  onClose,
}: Readonly<{
  enrollment: Parameters<typeof useEnrollmentViewModel>[0];
  passwordPolicy: Parameters<typeof useEnrollmentViewModel>[1];
  createChallenge: Parameters<typeof useEnrollmentViewModel>[2];
  onComplete: Parameters<typeof useEnrollmentViewModel>[3];
  onClose: () => void;
}>) {
  return <EnrollmentPage viewmodel={useEnrollmentViewModel(enrollment, passwordPolicy, createChallenge, onComplete, onClose)} />;
}
function Recovery({
  bootstrap,
  onChallenge,
  onReset,
  onClose,
}: Readonly<{ bootstrap: Parameters<typeof useRecoveryViewModel>[0]; onChallenge: Parameters<typeof useRecoveryViewModel>[1]; onReset: Parameters<typeof useRecoveryViewModel>[2]; onClose: () => void }>) {
  return <RecoveryDialog open viewmodel={useRecoveryViewModel(bootstrap, onChallenge, onReset, onClose)} />;
}
