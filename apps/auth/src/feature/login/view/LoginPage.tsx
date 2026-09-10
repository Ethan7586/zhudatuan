import type { ReactNode } from 'react';
import type { AuthTarget } from '@shop/config/client';
import type { FailureView } from '@shop/presentation';
import type { Bootstrap, LoginMethod as Method } from '../../bootstrap';
import { ProviderList, type Provider } from '../../federation';
import { AuthCard } from '../../../shell/AuthCard';
import { AuthShell } from '../../../shell/AuthShell';
import type { ActionResult } from '../../../shared/model/ActionResult';
import { Alert } from '../../../shared/view/Alert';
import { AuthSwitch } from '../../../shared/view/AuthSwitch';
import { LegalAgreement } from '../../../shared/view/LegalAgreement';
import { TargetPicker } from '../../../shared/view/TargetPicker';
import { targetTitle } from '../../../shared/model/Target';
import { LoginMethod } from './LoginMethod';
import { OtpForm } from './OtpForm';
import { PasswordForm } from './PasswordForm';
import type { ProviderCatalog } from '../model/ProviderCatalog';
import type { Challenge } from '../../challenge';

export interface LoginPageProps {
  readonly bootstrap: Bootstrap;
  readonly target: AuthTarget;
  readonly entryTarget: AuthTarget;
  readonly focusTarget?: AuthTarget;
  readonly method: Method;
  readonly accepted: boolean;
  readonly busy: boolean;
  readonly failure?: FailureView;
  readonly notice?: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly providers: ProviderCatalog;
  readonly providersLoading: boolean;
  readonly providerFailure?: FailureView;
  readonly stage?: ReactNode;
  readonly onMethod: (method: Method) => void;
  readonly onTarget: (target: AuthTarget) => void;
  readonly onAccepted: (accepted: boolean) => void;
  readonly onPassword: (subject: string, password: string) => void;
  readonly onOtp: (subject: string, challenge: string, code: string) => void;
  readonly onChallenge: (subject: string) => Promise<ActionResult<Challenge>>;
  readonly onRegister: () => void;
  readonly onProvider: (provider: Provider) => void;
  readonly onProviderRetry: () => void;
  readonly onBack: () => void;
  readonly onReset: () => void;
}

export function LoginPage(props: Readonly<LoginPageProps>) {
  const first = props.stage === undefined;
  const destination = targetTitle(props.target);
  const agreement = <LegalAgreement policy={props.bootstrap.legal} accepted={props.accepted} busy={props.busy} {...(props.fields.agreement ? { error: props.fields.agreement } : {})} onAccepted={props.onAccepted} />;
  return (
    <AuthShell>
      <AuthCard stage={first ? 1 : 2} onBack={props.onBack}>
        <section className="authpanel" aria-busy={props.busy}>
          <header>
            <h2>{first ? '统一账号认证' : '完成身份验证'}</h2>
            <p>{first ? '选择目标系统，并使用企业授予的身份安全登录。' : '完成本次验证后即可继续。'}</p>
          </header>
          <Alert {...(props.failure ? { failure: props.failure } : {})} {...(props.notice ? { notice: props.notice } : {})} />
          {first ? (
            <div className="authformstack">
              <TargetPicker target={props.target} entryTarget={props.entryTarget} {...(props.focusTarget ? { focusTarget: props.focusTarget } : {})} busy={props.busy} description="请选择登录成功后要进入的系统。" onTarget={props.onTarget} />
              <LoginMethod method={props.method} methods={props.providers.credentials} busy={props.busy} onChange={props.onMethod} />
              <div id={`auth-panel-${props.method}`} role="tabpanel" aria-labelledby={`auth-tab-${props.method}`} key={`${props.target}:${props.method}`}>
                {props.method === 'password' ? <PasswordForm busy={props.busy} error={props.fields} agreement={agreement} submitLabel={`登录并进入${destination}`} onSubmit={props.onPassword} onReset={props.onReset} /> : null}
                {props.method === 'otp' ? <OtpForm busy={props.busy} error={props.fields} agreement={agreement} submitLabel={`登录并进入${destination}`} onChallenge={props.onChallenge} onSubmit={props.onOtp} /> : null}
              </div>
              {props.providersLoading || props.providerFailure || props.providers.federations.length > 0 ? (
                <div className="authproviders">
                  <ProviderList providers={props.providers.federations} busy={props.busy} loading={props.providersLoading} failed={props.providerFailure !== undefined} onSelect={props.onProvider} />
                  {props.providerFailure ? <Alert failure={props.providerFailure} onAction={props.onProviderRetry} /> : null}
                </div>
              ) : null}
              <AuthSwitch destination="register" busy={props.busy} onSwitch={props.onRegister} />
            </div>
          ) : (
            props.stage
          )}
        </section>
      </AuthCard>
    </AuthShell>
  );
}
