import { ArrowRight, Building2, Info, ShieldCheck, Store } from 'lucide-react';
import type { MembershipChoice } from '../../entity/authentication/AuthenticationState';

export function MembershipSelection({
  memberships,
  busy,
  onSelect,
}: Readonly<{
  memberships: readonly MembershipChoice[];
  busy: boolean;
  onSelect: (membership: MembershipChoice) => void;
}>) {
  if (memberships.length === 0) return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">该账号当前没有可用的企业福利或运营身份，请联系企业管理员。</p>;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 px-4 py-3.5 text-xs text-slate-600">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--sw-brand)] shadow-sm ring-1 ring-blue-100">
          <Info className="h-4 w-4" />
        </div>
        <div>
          <p className="font-bold text-slate-800">一次登录，按需进入</p>
          <p className="mt-0.5 leading-relaxed text-slate-500">商城用于福利消费与订单；后台用于运营管理，仅展示你已经获得授权的工作台。</p>
        </div>
      </div>
      <div className="custom-scrollbar max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {memberships.map((membership) => {
          const consoleTarget = membership.target === 'console';
          return (
            <button
              key={membership.id}
              type="button"
              disabled={busy}
              onClick={() => onSelect(membership)}
              className={`group flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all ${consoleTarget ? 'border-slate-700 bg-slate-900 text-white hover:ring-2 hover:ring-[var(--sw-brand)]/30' : 'border-slate-200 bg-white text-slate-800 hover:border-[var(--sw-brand)] hover:bg-blue-50/20 hover:shadow-md'}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                {consoleTarget ? <ShieldCheck className="h-5 w-5 text-blue-300" /> : <Store className="h-5 w-5 text-[var(--sw-brand)]" />}
                <span>
                  <span className={`block text-sm font-semibold ${consoleTarget ? 'text-white' : 'text-slate-800'}`}>{consoleTarget ? '筑大团运营后台' : '筑大团福利商城'}</span>
                  <span className={`mt-1 flex items-center gap-1 text-xs ${consoleTarget ? 'text-slate-300' : 'text-slate-500'}`}>
                    <Building2 className="h-3 w-3" />
                    已授权企业 · {consoleTarget ? '运营会员' : '企业员工会员'}
                  </span>
                </span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 opacity-60" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
