import type { AuthTarget } from '../../entity/authentication/AuthenticationState';
import { LayoutDashboard, ShoppingBag } from 'lucide-react';

const targets: readonly Readonly<{ value: AuthTarget; title: string; description: string; icon: typeof ShoppingBag }>[] = Object.freeze([
  { value: 'storefront', title: '员工商城', description: '选购福利与查询订单', icon: ShoppingBag },
  { value: 'console', title: '运营控制台', description: '管理商城与企业运营', icon: LayoutDashboard },
]);

export function LoginTarget({ target, busy, onTarget }: Readonly<{ target: AuthTarget; busy: boolean; onTarget: (target: AuthTarget) => void }>) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold text-slate-700">登录后进入</legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="登录后进入">
        {targets.map((item) => {
          const Icon = item.icon;
          const selected = target === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() => onTarget(item.value)}
              className={`group flex min-h-[60px] items-center gap-2 rounded-xl border p-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${selected ? 'border-[var(--sw-brand)] bg-blue-50/80 shadow-sm shadow-blue-500/10' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${selected ? 'bg-[var(--sw-brand)] text-white' : 'bg-slate-100 text-slate-500 group-hover:text-[var(--sw-brand)]'}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <strong className={`block text-xs ${selected ? 'text-[var(--sw-brand)]' : 'text-slate-800'}`}>{item.title}</strong>
                <small className="mt-0.5 block text-[10px] leading-tight text-slate-600">{item.description}</small>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
