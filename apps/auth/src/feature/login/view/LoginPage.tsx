import { lazy, type ReactNode } from 'react';
import { Button } from '@shop/design';
import type { AuthTarget } from '@shop/config/client';
import type { FailureView } from '@shop/presentation';
import type { Bootstrap, LoginMethod as Method } from '../../bootstrap';
import { ProviderList, type Provider } from '../../federation';
import { InvitationForm, InvitationJourney } from '../../invitation';
import { AuthCard } from '../../../shell/AuthCard';
import { AuthShell } from '../../../shell/AuthShell';
import { Alert } from '../../../shared/ui/Alert';
import type { ActionResult } from '../../../shared/ui/ActionResult';
import { LoginMethod } from './LoginMethod';
import { LoginTarget } from './LoginTarget';
import { OtpForm } from './OtpForm';
import { PasswordForm } from './PasswordForm';
import { usePolicy } from '../viewmodel/LoginReducer';
import type { ProviderCatalog } from '../model/ProviderCatalog';
import type { Challenge } from '../../challenge';

const PolicyDialog = lazy(() => import('../../../shared/ui/PolicyDialog').then((module) => ({ default: module.PolicyDialog })));

export interface LoginPageProps {
  readonly bootstrap: Bootstrap;
  readonly target: AuthTarget;
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
  readonly invitationStep?: 1 | 2 | 3 | 4;
  readonly onMethod: (method: Method) => void;
  readonly onTarget: (target: AuthTarget) => void;
  readonly onAccepted: (accepted: boolean) => void;
  readonly onPassword: (subject: string, password: string) => void;
  readonly onOtp: (subject: string, challenge: string, code: string) => void;
  readonly onChallenge: (subject: string) => Promise<ActionResult<Challenge>>;
  readonly onInvitation: (code: string) => Promise<void>;
  readonly onProvider: (provider: Provider) => void;
  readonly onProviderRetry: () => void;
  readonly onBack: () => void;
  readonly onReset: () => void;
}

export function LoginPage(props: Readonly<LoginPageProps>) {
  const policy = usePolicy();
  const first = props.stage === undefined;
  return (
    <AuthShell>
      <AuthCard stage={first ? 1 : 2} onBack={props.onBack}>
        <section className="authpanel" aria-busy={props.busy}>
          <header>
            <h2>{first ? '统一账号认证' : '完成身份验证'}</h2>
            <p>{first ? '选择目标系统，并使用企业授予的身份安全登录。' : '完成本次验证后即可继续。'}</p>
          </header>
          <Alert {...(props.failure ? { failure: props.failure } : {})} {...(props.notice ? { notice: props.notice } : {})} />
          {props.invitationStep ? <InvitationJourney target={props.target} current={props.invitationStep} /> : null}
          {first ? (
            <div className="authformstack">
              <LoginTarget target={props.target} {...(props.focusTarget ? { focusTarget: props.focusTarget } : {})} busy={props.busy} onTarget={props.onTarget} />
              <LoginMethod method={props.method} methods={props.providers.credentials} busy={props.busy} onChange={props.onMethod} />
              <div id={`auth-panel-${props.method}`} role="tabpanel" aria-labelledby={`auth-tab-${props.method}`} key={`${props.target}:${props.method}`}>
                {props.method === 'password' ? <PasswordForm busy={props.busy} error={props.fields} onSubmit={props.onPassword} onReset={props.onReset} onInvitation={() => props.onMethod('invitation')} /> : null}
                {props.method === 'otp' ? <OtpForm busy={props.busy} error={props.fields} onChallenge={props.onChallenge} onSubmit={props.onOtp} /> : null}
                {props.method === 'invitation' ? <InvitationForm busy={props.busy} onSubmit={props.onInvitation} /> : null}
              </div>
              {props.providersLoading || props.providerFailure || props.providers.federations.length > 0 ? (
                <div className="authproviders">
                  <ProviderList providers={props.providers.federations} busy={props.busy} loading={props.providersLoading} failed={props.providerFailure !== undefined} onSelect={props.onProvider} />
                  {props.providerFailure ? <Alert failure={props.providerFailure} onAction={props.onProviderRetry} /> : null}
                </div>
              ) : null}
              <label className="authagreement">
                <input type="checkbox" checked={props.accepted} onChange={(event) => props.onAccepted(event.target.checked)} />
                <span>
                  我已阅读并同意
                  <Button tone="quiet" className="authinline" onPress={() => policy.open('terms')}>
                    《{props.bootstrap.legal.termsTitle}》
                  </Button>
                  和
                  <Button tone="quiet" className="authinline" onPress={() => policy.open('privacy')}>
                    《{props.bootstrap.legal.privacyTitle}》
                  </Button>
                </span>
              </label>
              {props.fields.agreement ? (
                <p className="authfieldissue" role="alert">
                  {props.fields.agreement}
                </p>
              ) : null}
            </div>
          ) : (
            props.stage
          )}
        </section>
        {policy.policy === undefined ? null : (
          <PolicyDialog
            policy={props.bootstrap.legal}
            kind={policy.policy}
            onClose={policy.close}
            onAccept={() => {
              props.onAccepted(true);
              policy.close();
            }}
          />
        )}
      </AuthCard>
    </AuthShell>
  );
}
