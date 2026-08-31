import { AlertCircle, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function MembershipPage({
  busy,
  error,
  hasSelection,
  children,
}: Readonly<{
  busy: boolean;
  error: string;
  hasSelection: boolean;
  children: ReactNode;
}>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-slate-950">选择你的工作台</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">仅展示本次登录目标下仍然有效的企业身份。</p>
        {busy && !hasSelection ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            正在核验身份…
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <AlertCircle className="mx-auto h-7 w-7 text-amber-600" />
            <p className="mt-3 text-sm leading-6 text-amber-900" role="alert">
              {error}
            </p>
            <a href="/" className="mt-5 inline-flex rounded-xl bg-[var(--sw-brand)] px-5 py-2.5 text-sm font-semibold text-white">
              返回登录
            </a>
          </div>
        ) : null}
        {!error ? <div className="mt-6">{children}</div> : null}
      </div>
    </main>
  );
}
