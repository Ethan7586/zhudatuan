import React from 'react';
import { LoaderCircle, LogIn, UserRoundCheck } from 'lucide-react';
import type { SessionStatus } from '../../context/MallContext.types';
import type { UserProfile } from '../../types';

interface MPAuthStatusCardProps {
  authHref?: string;
  sessionStatus: SessionStatus;
  user: UserProfile;
  onOpenProfile: () => void;
}

const cardClassName = 'flex h-[68px] w-full items-center justify-between rounded-xl border border-white/20 bg-white px-3.5 text-left shadow-sm';

export const AUTH_WELCOME_HOLD_MS = 1600;
export const AUTH_WELCOME_EXIT_MS = 420;

export function MPAuthStatusCard({ authHref, sessionStatus, user, onOpenProfile }: MPAuthStatusCardProps) {
  const [welcomePhase, setWelcomePhase] = React.useState<'visible' | 'leaving' | 'hidden'>('visible');

  React.useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      setWelcomePhase('visible');
      return undefined;
    }

    setWelcomePhase('visible');
    const leaveTimer = window.setTimeout(() => setWelcomePhase('leaving'), AUTH_WELCOME_HOLD_MS);
    const hideTimer = window.setTimeout(() => setWelcomePhase('hidden'), AUTH_WELCOME_HOLD_MS + AUTH_WELCOME_EXIT_MS);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, [sessionStatus, user.id]);

  if (sessionStatus === 'authenticated' && welcomePhase === 'hidden') return null;

  const isWelcomeLeaving = sessionStatus === 'authenticated' && welcomePhase === 'leaving';

  return (
    <div
      className={`overflow-hidden bg-[var(--sw-brand-dark)] px-3 transition-[max-height,opacity,transform,padding] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none motion-reduce:transition-none ${
        isWelcomeLeaving ? 'pointer-events-none max-h-0 -translate-y-5 pb-0 opacity-0' : 'max-h-[88px] translate-y-0 pb-3 opacity-100'
      }`}
      data-auth-shell={sessionStatus}
      data-auth-phase={welcomePhase}
    >
      {sessionStatus === 'checking' ? (
        <div className={cardClassName} role="status" aria-live="polite" aria-busy="true">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-blue-50 text-[var(--sw-brand)]">
              <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-900">正在恢复登录状态</span>
              <span className="block truncate text-[10px] text-slate-500">商城内容已就绪，会员账户正在同步</span>
            </span>
          </span>
          <span className="ml-2 flex-none rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[var(--sw-brand)]">请稍候</span>
        </div>
      ) : sessionStatus === 'guest' ? (
        <a
          href={authHref}
          aria-label="使用手机号登录智慧翼账户"
          className={`${cardClassName} active:scale-[0.99]`}
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
          className={`${cardClassName} active:scale-[0.99]`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <UserRoundCheck className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-900">欢迎回来，{user.name}</span>
              <span className="block truncate text-[10px] text-slate-500">会员身份已确认，账户数据后台同步</span>
            </span>
          </span>
          <span className="ml-2 flex-none rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">查看账户</span>
        </button>
      )}
    </div>
  );
}
