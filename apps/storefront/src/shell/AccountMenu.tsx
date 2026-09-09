import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import type { ShellViewModel } from './ShellViewModel';

export function AccountMenu({ viewmodel, inverse = false }: Readonly<{ viewmodel: ShellViewModel; inverse?: boolean }>) {
  const account = viewmodel.navigation.quick.find(({ kind }) => kind === 'account');
  if (!account) return null;
  return (
    <details className="group relative">
      <summary
        aria-label={viewmodel.account.authenticated ? `${viewmodel.account.name}的账户菜单` : account.label}
        className={`${inverse ? 'text-inverse hover:bg-surface/10' : 'hover:bg-subtle'} flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-lg px-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
      >
        <UserRound size={15} aria-hidden="true" />
        <span className="max-w-32 truncate text-xs font-bold">{viewmodel.account.name}</span>
        <ChevronDown size={13} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-edge bg-surface p-2 text-content shadow-xl">
        <button type="button" onClick={() => viewmodel.actions.navigate(account.path)} className="w-full rounded-lg px-3 py-3 text-left hover:bg-subtle">
          <strong className="block text-sm text-content">{viewmodel.account.name}</strong>
          <span className="mt-1 block truncate text-xs text-muted">
            {viewmodel.brand.enterprise} · {viewmodel.brand.badge}
          </span>
        </button>
        {viewmodel.account.malls.length > 1 ? (
          <div className="mt-1 border-t border-edge px-1 pt-2">
            <p className="px-2 pb-1 text-[11px] font-bold text-muted">切换福利商城</p>
            {viewmodel.account.malls.map((mall) => (
              <button
                type="button"
                key={mall.membershipId ?? mall.id}
                disabled={mall.id === viewmodel.account.currentMall.id}
                onClick={() => mall.membershipId && viewmodel.actions.switchMall(mall.membershipId)}
                className="flex min-h-10 w-full items-center justify-between rounded-lg px-2 text-left text-xs hover:bg-subtle disabled:cursor-default disabled:bg-brand-light disabled:text-brand-dark"
              >
                <span className="truncate">{mall.mallName}</span>
                <span>{mall.id === viewmodel.account.currentMall.id ? '当前' : '切换'}</span>
              </button>
            ))}
          </div>
        ) : null}
        {viewmodel.account.authenticated ? (
          <button type="button" onClick={() => void viewmodel.actions.logout()} className="mt-1 flex min-h-10 w-full items-center gap-2 border-t border-edge px-3 pt-2 text-left text-xs font-bold text-danger-strong hover:bg-danger-surface">
            <LogOut size={16} aria-hidden="true" />
            安全退出
          </button>
        ) : null}
      </div>
    </details>
  );
}
