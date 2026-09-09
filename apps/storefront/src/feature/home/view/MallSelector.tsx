import { Building2, ChevronDown } from 'lucide-react';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';

export function MallSelector({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  const canSwitch = viewmodel.malls.length > 1;
  return (
    <section aria-label="当前企业福利商城" className="rounded-2xl border border-edge bg-surface p-2 shadow-sm lg:hidden">
      {canSwitch ? (
        <details className="group relative">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-2 hover:bg-subtle">
            <Identity viewmodel={viewmodel} />
            <ChevronDown size={16} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-2 grid gap-1 border-t border-edge pt-2">
            {viewmodel.malls.map((mall) => (
              <button
                type="button"
                key={mall.membershipId ?? mall.id}
                disabled={mall.id === viewmodel.currentMall.id || !mall.membershipId}
                onClick={() => mall.membershipId && viewmodel.switchMall(mall.membershipId)}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-left text-xs hover:bg-subtle disabled:bg-brand-light disabled:text-brand-dark"
              >
                <span className="min-w-0">
                  <b className="block truncate">{mall.enterpriseName}</b>
                  <span className="mt-0.5 block truncate text-[10px] text-muted">{mall.mallName}</span>
                </span>
                <span className="shrink-0 font-bold">{mall.id === viewmodel.currentMall.id ? '当前' : '切换'}</span>
              </button>
            ))}
          </div>
        </details>
      ) : (
        <div className="flex min-h-12 items-center gap-3 rounded-xl px-2">
          <Identity viewmodel={viewmodel} />
          <span className="shrink-0 rounded-full bg-brand-light px-2 py-1 text-[10px] font-bold text-brand-dark">当前商城</span>
        </div>
      )}
    </section>
  );
}

function Identity({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useHomeViewModel> }>) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-light text-brand">
        <Building2 size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-medium text-muted">当前企业福利商城</span>
        <b className="block truncate text-sm">{viewmodel.currentMall.enterpriseName}</b>
      </span>
    </span>
  );
}
