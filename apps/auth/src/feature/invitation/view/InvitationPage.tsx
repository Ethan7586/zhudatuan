import { Button } from '@shop/design';
import { CheckCircle2, LogIn } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AuthTarget } from '@shop/config/client';
import type { FailureView } from '@shop/presentation';
import type { Bootstrap } from '../../bootstrap';
import { AuthCard } from '../../../shell/AuthCard';
import { AuthShell } from '../../../shell/AuthShell';
import { Alert } from '../../../shared/view/Alert';
import { AuthSwitch } from '../../../shared/view/AuthSwitch';
import { LegalAgreement } from '../../../shared/view/LegalAgreement';
import { Loading } from '../../../shared/view/Loading';
import { TargetPicker } from '../../../shared/view/TargetPicker';
import { targetTitle } from '../../../shared/model/Target';
import { InvitationForm } from './InvitationForm';
import { InvitationJourney } from './InvitationJourney';
import type { InvitationMode } from '../model/Invitation';

export interface InvitationPageProps {
  readonly bootstrap: Bootstrap;
  readonly target: AuthTarget;
  readonly focusTarget?: AuthTarget;
  readonly accepted: boolean;
  readonly busy: boolean;
  readonly fields: Readonly<Record<string, string>>;
  readonly failure?: FailureView;
  readonly notice?: string;
  readonly stage?: ReactNode;
  readonly current: 1 | 2 | 3 | 4;
  readonly mode: InvitationMode;
  readonly complete: boolean;
  readonly onTarget: (target: AuthTarget) => void;
  readonly onAccepted: (accepted: boolean) => void;
  readonly onInvitation: (code: string) => Promise<void>;
  readonly onBack: () => void;
  readonly onLogin: () => void;
}

export function InvitationPage(props: Readonly<InvitationPageProps>) {
  const first = props.mode === 'unknown' && !props.complete;
  const destination = targetTitle(props.target);
  const heading = props.complete ? '账号注册成功' : props.mode === 'enrollment' ? '完成账号注册' : props.mode === 'signin' ? '确认受邀成员身份' : '验证企业邀请';
  const description = props.complete
    ? '你的账号已经创建，可以返回登录。'
    : props.mode === 'enrollment'
      ? '邀请已验证，请完善账号并完成手机验证。'
      : props.mode === 'signin'
        ? '本次不会创建账号；验证成功后按现有权限进入系统。'
        : '系统会识别这是新员工注册，还是现有成员安全进入。';
  return (
    <AuthShell>
      <AuthCard flow="invitation" stage={first ? 1 : 2} onBack={props.onBack}>
        <section className="authpanel" aria-busy={props.busy}>
          <header>
            <h2>{heading}</h2>
            <p>{description}</p>
          </header>
          <Alert {...(props.failure ? { failure: props.failure } : {})} {...(props.notice ? { notice: props.notice } : {})} />
          <InvitationJourney target={props.target} current={props.current} mode={props.mode} />
          {props.complete ? (
            <section className="registrationreceipt" role="status">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <h3>注册已完成</h3>
                <p>请使用刚刚设置的账号和密码登录{destination}。</p>
              </div>
              <Button tone="primary" className="authfull" onPress={props.onLogin}>
                <LogIn aria-hidden="true" />
                返回登录
              </Button>
            </section>
          ) : first ? (
            <div className="authformstack">
              <TargetPicker target={props.target} {...(props.focusTarget ? { focusTarget: props.focusTarget } : {})} busy={props.busy} description="先选择邀请码对应的目标系统；验证后，系统会自动进入正确流程。" onTarget={props.onTarget} />
              <InvitationForm
                busy={props.busy}
                {...(props.fields.invitation ? { error: props.fields.invitation } : {})}
                agreement={<LegalAgreement policy={props.bootstrap.legal} accepted={props.accepted} busy={props.busy} {...(props.fields.agreement ? { error: props.fields.agreement } : {})} onAccepted={props.onAccepted} />}
                onSubmit={props.onInvitation}
              />
              <AuthSwitch destination="login" busy={props.busy} onSwitch={props.onLogin} />
            </div>
          ) : (
            (props.stage ?? <Loading label={props.mode === 'signin' ? '正在准备成员身份验证…' : '正在准备账号注册…'} />)
          )}
        </section>
      </AuthCard>
    </AuthShell>
  );
}
