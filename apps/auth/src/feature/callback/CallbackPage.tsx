import { RefreshCw } from 'lucide-react';

export function CallbackPage() {
  return <Status title="正在完成企业登录" detail="身份提供方回调由服务端处理，请勿关闭当前页面。" />;
}

function Status({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-2xl">
        <RefreshCw className="mx-auto h-7 w-7 animate-spin text-[var(--sw-brand)]" />
        <h1 className="mt-4 text-xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-500" role="status" aria-live="polite">
          {detail}
        </p>
      </div>
    </main>
  );
}
