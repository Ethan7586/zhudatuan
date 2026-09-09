import { ChevronRight, CreditCard, Gift, Package } from 'lucide-react';
import { formatMinor } from '../../../shared/format/Money';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { orderStatusText } from '../../order';

type ViewModel = ReturnType<typeof useHomeViewModel>;
export function AccountSummary({ viewmodel }: Readonly<{ viewmodel: ViewModel }>) {
  const recent = viewmodel.orders[0];
  return (
    <aside className="space-y-3 lg:sticky lg:top-24">
      <section className="rounded-3xl border border-brand-light bg-gradient-to-br from-surface to-brand-faint p-4 shadow-sm lg:p-5">
        {viewmodel.profileState === 'loading' ? (
          <p role="status" className="py-8 text-center text-xs text-muted">
            正在读取账户与权益余额…
          </p>
        ) : null}
        {viewmodel.profileState === 'failed' ? (
          <div role="alert" className="grid gap-2 py-5 text-center text-xs text-danger-strong">
            <b>{viewmodel.profileMessage ?? '账户信息加载失败'}</b>
            <button type="button" onClick={() => void viewmodel.retryProfile()} className="rounded-lg bg-brand-light px-3 py-2 font-bold text-brand">
              重试
            </button>
          </div>
        ) : null}
        {viewmodel.profileState === 'ready' ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-edge pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand text-base font-black text-inverse lg:h-12 lg:w-12 lg:text-lg">{viewmodel.user.name.slice(0, 1)}</span>
                <div className="min-w-0">
                  <b className="block truncate text-sm lg:text-base">{viewmodel.user.name}</b>
                  <span className="block truncate text-[11px] text-muted lg:text-xs">{viewmodel.currentMall.enterpriseName}</span>
                </div>
              </div>
              <button type="button" onClick={() => viewmodel.navigatePage('catalog')} className="flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-bold text-brand lg:hidden">
                去选购
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:mt-4 lg:grid-cols-1">
              <button type="button" onClick={() => viewmodel.openFeature('账户流水')} className="min-w-0 rounded-2xl bg-brand-light p-3 text-left">
                <CreditCard size={18} className="text-brand" />
                <span className="mt-2 block truncate text-[11px] font-medium text-secondary lg:text-xs">福利卡可用</span>
                <b className="block truncate text-base lg:text-lg">¥{formatMinor(viewmodel.user.welfareBalanceMinor)}</b>
              </button>
              <button type="button" onClick={() => viewmodel.openFeature('账户流水')} className="min-w-0 rounded-2xl bg-success-surface p-3 text-left">
                <Gift size={18} className="text-success-strong" />
                <span className="mt-2 block truncate text-[11px] font-medium text-secondary lg:text-xs">餐卡可用</span>
                <b className="block truncate text-base lg:text-lg">¥{formatMinor(viewmodel.user.mealBalanceMinor)}</b>
              </button>
            </div>
          </>
        ) : null}
      </section>
      <section className="hidden rounded-3xl border border-edge bg-surface p-5 shadow-sm lg:block">
        <div className="flex items-center justify-between">
          <b>最近订单</b>
          <button type="button" onClick={() => viewmodel.navigatePage('orders')} className="text-xs font-bold text-brand">
            全部订单
          </button>
        </div>
        {recent ? (
          <div className="mt-3 rounded-2xl bg-subtle p-3 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <Package size={15} />
              {recent.orderNo}
            </div>
            <p className="mt-2 text-muted">
              {orderStatusText(recent.status)} · {recent.lines.length} 件商品
            </p>
          </div>
        ) : viewmodel.orderState === 'loading' ? (
          <p className="mt-4 text-center text-xs text-muted">正在读取最近订单…</p>
        ) : viewmodel.orderState === 'failed' ? (
          <p role="alert" className="mt-4 text-center text-xs text-danger-strong">
            最近订单暂时不可用
          </p>
        ) : (
          <p className="mt-4 text-center text-xs text-muted">暂无订单记录</p>
        )}
      </section>
    </aside>
  );
}
