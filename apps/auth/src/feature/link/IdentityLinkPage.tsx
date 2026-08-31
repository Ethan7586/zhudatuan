import { AlertCircle } from 'lucide-react';

export function IdentityLinkPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-2xl">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-4 text-xl font-bold text-slate-950">需要确认身份关联</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">检测到已有身份或绑定冲突。系统不会自动合并账号，请联系企业管理员完成强验证与人工确认。</p>
      </div>
    </main>
  );
}
