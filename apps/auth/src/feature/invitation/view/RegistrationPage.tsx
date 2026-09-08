import { Button } from '@shop/design';
import { CheckCircle2, LogIn } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AuthTarget } from '@shop/config/client';
import type { FailureView } from '@shop/presentation';
import type { Bootstrap } from '../../bootstrap';
import { AuthCard } from '../../../shell/AuthCard';
import { AuthShell } from '../../../shell/AuthShell';
import { Alert } from '../../../shared/ui/Alert';
import { AuthSwitch } from '../../../shared/ui/AuthSwitch';
import { LegalAgreement } from '../../../shared/ui/LegalAgreement';
import { TargetPicker } from '../../../shared/ui/TargetPicker';
import { targetTitle } from '../../../shared/model/Target';
import { InvitationForm } from './InvitationForm';
import { InvitationJourney } from './InvitationJourney';

export interface RegistrationPageProps {
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
  readonly complete: boolean;
  readonly onTarget: (target: AuthTarget) => void;
  readonly onAccepted: (accepted: boolean) => void;
  readonly onInvitation: (code: string) => Promise<void>;
  readonly onBack: () => void;
  readonly onLogin: () => void;
}

export function RegistrationPage(props: Readonly<RegistrationPageProps>) {
  const first = props.stage === undefined;
  const destination = targetTitle(props.target);
  return (
    <AuthShell>
      <AuthCard flow="registration" stage={first ? 1 : 2} onBack={props.onBack}>
        <section className="authpanel" aria-busy={props.busy}>
          <header>
            <h2>{props.complete ? '账号注册成功' : first ? '使用企业邀请码注册' : '完成邀请验证'}</h2>
            <p>{props.complete ? '你的账号已经创建，可以返回登录。' : '邀请码只用于确认企业、身份和可进入的系统。'}</p>
          </header>
          <Alert {...(props.failure ? { failure: props.failure } : {})} {...(props.notice ? { notice: props.notice } : {})} />
          <InvitationJourney target={props.target} current={props.current} />
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
              <TargetPicker target={props.target} {...(props.focusTarget ? { focusTarget: props.focusTarget } : {})} busy={props.busy} description="请选择注册完成后要进入的系统，邀请码会再次校验权限。" onTarget={props.onTarget} />
              <InvitationForm
                busy={props.busy}
                {...(props.fields.invitation ? { error: props.fields.invitation } : {})}
                agreement={<LegalAgreement policy={props.bootstrap.legal} accepted={props.accepted} busy={props.busy} {...(props.fields.agreement ? { error: props.fields.agreement } : {})} onAccepted={props.onAccepted} />}
                onSubmit={props.onInvitation}
              />
              <AuthSwitch destination="login" busy={props.busy} onSwitch={props.onLogin} />
            </div>
          ) : (
            props.stage
          )}
        </section>
      </AuthCard>
    </AuthShell>
  );
}
