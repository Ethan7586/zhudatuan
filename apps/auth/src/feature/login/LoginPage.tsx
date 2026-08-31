import type { ReactNode } from 'react';
import type { AuthMethod, AuthTarget, ProviderChoice } from '../../entity/authentication/AuthenticationState';
import { LoginAlert } from '../../shared/ui/LoginAlert';
import { LoginCard } from '../../shared/ui/LoginCard';
import { InvitationForm } from './InvitationForm';
import { OtpForm } from './OtpForm';
import { PasswordForm } from './PasswordForm';
import { ProviderList } from './ProviderList';
import { LoginTarget } from './LoginTarget';

interface LoginPageProps {
  readonly target: AuthTarget;
  readonly method: AuthMethod;
  readonly accepted: boolean;
  readonly busy: boolean;
  readonly error: string;
  readonly notice: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly providers: readonly ProviderChoice[];
  readonly stage: 'selection' | 'proofRequired' | null;
  readonly stageContent: ReactNode;
  readonly alert?: ReactNode;
  readonly onMethod: (method: AuthMethod) => void;
  readonly onTarget: (target: AuthTarget) => void;
  readonly onAccepted: (accepted: boolean) => void;
  readonly onPassword: (subject: string, password: string) => void;
  readonly onOtp: (subject: string, challenge: string, code: string) => void;
  readonly onChallenge: (subject: string) => Promise<Readonly<{ id: string; resendSeconds: number }>>;
  readonly onInvitation: (code: string) => Promise<void>;
  readonly onProvider: (provider: ProviderChoice) => void;
  readonly onBack: () => void;
  readonly onReset: () => void;
  readonly onTerms: (kind: 'terms' | 'privacy') => void;
}

export function LoginPage(props: Readonly<LoginPageProps>) {
  const first = props.stage === null;
  return (
    <div className="flex min-h-screen flex-col justify-between overflow-x-hidden bg-slate-50 selection:bg-blue-100 selection:text-[var(--sw-brand)]">
      <LoginCard stage={first ? 1 : 2} onBack={props.onBack}>
        <div className="mb-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{first ? '统一账号认证' : props.stage === 'proofRequired' ? '完成安全验证' : '选择你的工作台'}</h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">{first ? '先选择登录后要进入的系统，再完成身份核验' : props.stage === 'proofRequired' ? '请完成与本次邀请绑定的身份校验' : '同一账号，可在福利消费与运营管理之间自由切换。'}</p>
        </div>
        {props.alert ? <div className="mb-5">{props.alert}</div> : <LoginAlert error={props.error} notice={props.notice} />}
        {first && (
          <div className="flex min-h-[460px] flex-col gap-3">
            <LoginTarget target={props.target} busy={props.busy} onTarget={props.onTarget} />
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-medium" role="tablist" aria-label="登录方式">
              {(
                [
                  ['password', '密码登录'],
                  ['otp', '验证码登录'],
                  ['invitation', '邀请码登录'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => props.onMethod(value)}
                  className={`rounded-lg px-1 py-2 text-center transition-all ${props.method === value ? 'bg-white font-bold text-[var(--sw-brand)] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  role="tab"
                  aria-selected={props.method === value}
                  aria-controls="login-method-panel"
                >
                  {label}
                </button>
              ))}
            </div>
            <div id="login-method-panel" role="tabpanel" aria-live="polite">
              {props.method === 'password' && <PasswordForm busy={props.busy} accepted={props.accepted} error={props.fields} onSubmit={props.onPassword} onReset={props.onReset} onInvitation={() => props.onMethod('invitation')} />}
              {props.method === 'otp' && <OtpForm busy={props.busy} accepted={props.accepted} error={props.fields} onChallenge={props.onChallenge} onSubmit={props.onOtp} />}
              {props.method === 'invitation' && <InvitationForm busy={props.busy} accepted={props.accepted} onSubmit={props.onInvitation} />}
            </div>
            <ProviderList providers={props.providers} busy={props.busy} onSelect={props.onProvider} />
            <div className="mt-auto border-t border-slate-100 pt-3">
              <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={props.accepted} onChange={(event) => props.onAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--sw-brand)] focus:ring-[var(--sw-brand)]" />
                <span className="leading-tight">
                  我已阅读并同意
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      props.onTerms('terms');
                    }}
                    className="text-[var(--sw-brand)] hover:underline"
                  >
                    《用户服务协议》
                  </button>
                  和
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      props.onTerms('privacy');
                    }}
                    className="text-[var(--sw-brand)] hover:underline"
                  >
                    《隐私保护政策》
                  </button>
                </span>
              </label>
            </div>
          </div>
        )}
        {props.stageContent}
      </LoginCard>
      <footer className="border-t border-slate-100 bg-white py-4 text-center text-xs text-slate-400">
        <p>© 2026 智慧翼企业福利商城. All Rights Reserved. 技术服务方：雍彻科技</p>
      </footer>
    </div>
  );
}
