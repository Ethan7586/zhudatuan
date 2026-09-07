import React from 'react';
import { LogIn, UserRoundCheck } from 'lucide-react';
import type { SessionStatus } from '../../context/MallContext.types';
import type { UserProfile } from '../../types';

interface MPAuthStatusCardProps {
  authHref?: string;
  sessionStatus: SessionStatus;
  user: UserProfile;
  onOpenProfile: () => void;
}

const cardClassName = 'flex h-[68px] w-full items-center rounded-xl border border-white/20 bg-white px-3.5 text-left shadow-sm';

export const AUTH_WELCOME_HOLD_MS = 2200;
export const AUTH_WELCOME_FADE_MS = 720;
export const AUTH_WELCOME_COLLAPSE_MS = 520;
export const AUTH_WELCOME_EXIT_MS = AUTH_WELCOME_FADE_MS + AUTH_WELCOME_COLLAPSE_MS;

export function MPAuthStatusCard({ authHref, sessionStatus, user, onOpenProfile }: MPAuthStatusCardProps) {
  const [welcomePhase, setWelcomePhase] = React.useState<'visible' | 'fading' | 'collapsing' | 'hidden'>('visible');

  React.useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      setWelcomePhase('visible');
      return undefined;
    }

    setWelcomePhase('visible');
    const fadeTimer = window.setTimeout(() => setWelcomePhase('fading'), AUTH_WELCOME_HOLD_MS);
    const collapseTimer = window.setTimeout(
      () => setWelcomePhase('collapsing'),
      AUTH_WELCOME_HOLD_MS + AUTH_WELCOME_FADE_MS,
    );
    const hideTimer = window.setTimeout(() => setWelcomePhase('hidden'), AUTH_WELCOME_HOLD_MS + AUTH_WELCOME_EXIT_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(collapseTimer);
      window.clearTimeout(hideTimer);
    };
  }, [sessionStatus, user.id]);

  if (sessionStatus === 'authenticated' && welcomePhase === 'hidden') return null;

  const isWelcomeFading = sessionStatus === 'authenticated' && (welcomePhase === 'fading' || welcomePhase === 'collapsing');
  const isWelcomeCollapsing = sessionStatus === 'authenticated' && welcomePhase === 'collapsing';

  return (
    <div
      className={`overflow-hidden bg-[var(--sw-brand-dark)] px-3 transition-[height,padding-bottom] duration-[520ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
        isWelcomeCollapsing ? 'pointer-events-none h-0 pb-0' : 'h-20 pb-3'
      }`}
      data-auth-shell={sessionStatus}
      data-auth-phase={welcomePhase}
    >
      {sessionStatus === 'checking' ? (
        <div
          className={`${cardClassName} justify-center`}
          role="status"
          aria-label="正在确认会员身份"
          aria-live="polite"
          aria-busy="true"
        >
          <span
            data-auth-loader="visual"
            aria-hidden="true"
            className="flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-full bg-slate-50 ring-1 ring-inset ring-slate-100"
          >
            <span className="sw-auth-loader-dot h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
            <span className="sw-auth-loader-dot h-1.5 w-1.5 rounded-full bg-[#06B6D4]" />
            <span className="sw-auth-loader-dot h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
            <span className="sw-auth-loader-dot h-1.5 w-1.5 rounded-full bg-[#10B981]" />
          </span>
        </div>
      ) : sessionStatus === 'guest' ? (
        <a
          href={authHref}
          aria-label="使用手机号登录智慧翼账户"
          className={`${cardClassName} justify-between active:scale-[0.99]`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-blue-50 text-[var(--sw-brand)]">
              <LogIn className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-900">手机号登录</span>
              <span className="block truncate text-[10px] text-slate-500">登录后查看会员身份、订单与支付</span>
            </span>
          </span>
          <span className="ml-2 flex-none rounded-full bg-[var(--sw-brand)] px-3 py-1.5 text-xs font-bold text-white">登录</span>
        </a>
      ) : (
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label={`查看${user.name}的会员账户`}
          className={`${cardClassName} justify-between transition-[opacity,transform] duration-[720ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
            isWelcomeFading
              ? 'pointer-events-none -translate-y-2 scale-[0.985] opacity-0'
              : 'sw-auth-welcome-card translate-y-0 scale-100 opacity-100 active:opacity-90'
          }`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <UserRoundCheck className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-900">{user.name}，欢迎回来</span>
              <span className="block truncate text-[10px] text-slate-500">很高兴再次见到你</span>
            </span>
          </span>
          <span className="ml-2 flex-none rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">查看账户</span>
        </button>
      )}
    </div>
  );
}
