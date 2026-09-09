import { Bell, Building2, ChevronDown, FileText, Headphones, Menu, ShieldCheck, ShoppingCart } from 'lucide-react';
import { Brand } from '@shop/design';
import { formatMinor } from '../shared/format/Money';
import { responsivePattern } from '../shared/view/ResponsivePattern';
import { ROUTES } from '../generated/RouteBinding';
import type { ShellViewModel } from './ShellViewModel';
import { shellPathActive } from './ShellNavigation';
import { HeaderSearch } from './HeaderSearch';
import { AccountMenu } from './AccountMenu';
import { CartCount } from './CompactHeader';

export function CommerceHeader({ viewmodel }: Readonly<{ viewmodel: ShellViewModel }>) {
  const orders = viewmodel.navigation.mobile.find(({ kind }) => kind === 'orders');
  const support = viewmodel.navigation.quick.find(({ kind }) => kind === 'support');
  const notifications = viewmodel.navigation.quick.find(({ kind }) => kind === 'notification');
  const cart = viewmodel.navigation.quick.find(({ kind }) => kind === 'cart');
  return (
    <header data-storefront-shell="desktop" className="sticky top-0 z-40 hidden bg-surface shadow-sm lg:block">
      <section data-storefront-tier="identity" className="bg-brand-ink text-inverse">
        <div className={`${responsivePattern.frame} ${responsivePattern.gutter} flex min-h-9 items-center justify-between gap-4`}>
          <div className="flex min-w-0 items-center gap-3">
            <MallSwitcher viewmodel={viewmodel} />
            <span className="hidden truncate text-[11px] text-inverse-label xl:block">{viewmodel.account.currentMall.welcomeBanner}</span>
          </div>
          <nav aria-label="账户快捷入口" className="flex shrink-0 items-center gap-1 text-xs">
            {orders ? <UtilityAction icon={FileText} label={orders.label} run={() => viewmodel.actions.navigate(orders.path)} /> : null}
            {support ? <UtilityAction icon={Headphones} label={support.label} run={() => viewmodel.actions.navigate(support.path)} /> : null}
            {notifications ? <UtilityAction icon={Bell} label={notifications.label} run={() => viewmodel.actions.navigate(notifications.path)} compact /> : null}
            <AccountMenu viewmodel={viewmodel} inverse />
          </nav>
        </div>
      </section>

      <section data-storefront-tier="commerce" className="border-b border-edge bg-surface">
        <div className={`${responsivePattern.frame} ${responsivePattern.gutter} flex min-h-[68px] items-center gap-4`}>
          <button type="button" onClick={viewmodel.actions.home} className="flex min-h-11 shrink-0 items-center text-left" aria-label={`返回${viewmodel.brand.name}首页`}>
            <Brand variant="mark" product={viewmodel.brand.name} />
          </button>
          {viewmodel.navigation.search ? <HeaderSearch search={viewmodel.actions.search} /> : <div className="mx-auto flex-1" />}
          <BalanceSummary viewmodel={viewmodel} />
          {cart ? (
            <button type="button" onClick={() => viewmodel.actions.navigate(cart.path)} aria-label={`${cart.label}，共 ${viewmodel.cartCount} 件`} className="relative flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-edge-strong bg-surface px-3 text-xs font-bold hover:border-brand hover:text-brand">
              <ShoppingCart size={18} className="text-brand" aria-hidden="true" />
              <span className="hidden xl:inline">购物车</span>
              {viewmodel.cartCount > 0 ? <CartCount count={viewmodel.cartCount} /> : null}
            </button>
          ) : null}
        </div>
      </section>

      <section data-storefront-tier="navigation" className="bg-brand-dark text-inverse">
        <div className={`${responsivePattern.frame} ${responsivePattern.gutter} flex min-h-11 items-stretch`}>
          {viewmodel.navigation.search ? (
            <button type="button" onClick={viewmodel.actions.catalog} className="flex w-48 shrink-0 items-center justify-between bg-brand px-4 text-sm font-bold text-inverse hover:bg-brand-dark xl:w-52">
              <span className="flex items-center gap-2 whitespace-nowrap"><Menu size={17} aria-hidden="true" />全部分类</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          ) : null}
          <nav className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto" aria-label="商城导航">
            {[...viewmodel.navigation.primary, ...viewmodel.navigation.published].map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => viewmodel.actions.navigate(item.path)}
                aria-current={shellPathActive(viewmodel.pathname, item.path) ? 'page' : undefined}
                className="min-h-11 shrink-0 whitespace-nowrap px-3 text-xs font-bold text-inverse-label hover:bg-surface/10 hover:text-inverse aria-[current=page]:bg-surface/15 aria-[current=page]:text-warning"
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="hidden shrink-0 items-center gap-1.5 pl-3 text-[11px] text-inverse-label 2xl:flex">
            <ShieldCheck size={15} className="text-warning" aria-hidden="true" />
            合规采购 · 余额保障 · 订单可追溯
          </div>
        </div>
      </section>
    </header>
  );
}

function MallSwitcher({ viewmodel }: Readonly<{ viewmodel: ShellViewModel }>) {
  if (viewmodel.account.malls.length <= 1) {
    return <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-warning"><Building2 size={14} aria-hidden="true" /><span className="truncate">{viewmodel.brand.enterprise}</span></span>;
  }
  return (
    <details className="group relative">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg bg-surface/10 px-2 text-xs font-bold text-warning hover:bg-surface/15">
        <Building2 size={14} aria-hidden="true" />
        <span className="max-w-48 truncate">{viewmodel.brand.enterprise}</span>
        <ChevronDown size={13} className="group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="absolute left-0 top-10 z-50 w-64 rounded-xl border border-edge bg-surface p-2 text-content shadow-xl">
        <p className="px-2 pb-2 text-[11px] font-bold text-muted">切换企业专享商城</p>
        {viewmodel.account.malls.map((mall) => (
          <button key={mall.membershipId ?? mall.id} type="button" disabled={mall.id === viewmodel.account.currentMall.id} onClick={() => mall.membershipId && viewmodel.actions.switchMall(mall.membershipId)} className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-xs hover:bg-subtle disabled:bg-brand-light disabled:text-brand-dark">
            <span className="truncate">{mall.enterpriseName}</span>
            <span className="shrink-0">{mall.id === viewmodel.account.currentMall.id ? '当前' : '切换'}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

function UtilityAction({ icon: Icon, label, run, compact = false }: Readonly<{ icon: typeof FileText; label: string; run: () => void; compact?: boolean }>) {
  return (
    <button type="button" onClick={run} aria-label={label} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-inverse-label hover:bg-surface/10 hover:text-inverse">
      <Icon size={14} aria-hidden="true" />
      <span className={compact ? 'hidden xl:inline' : ''}>{label}</span>
    </button>
  );
}

function BalanceSummary({ viewmodel }: Readonly<{ viewmodel: ShellViewModel }>) {
  if (!viewmodel.account.authenticated || viewmodel.account.profileState !== 'ready') return null;
  return (
    <div className="hidden shrink-0 items-center gap-2 xl:flex" aria-label="账户余额概览">
      <button type="button" onClick={() => viewmodel.actions.navigate(ROUTES.storebenefits)} className="min-h-11 rounded-lg border border-brand-light bg-brand-faint px-3 text-left">
        <span className="block text-[10px] font-medium text-secondary">福利卡可用</span>
        <b className="block text-sm text-brand-dark">¥{formatMinor(viewmodel.account.welfareBalanceMinor)}</b>
      </button>
      <button type="button" onClick={() => viewmodel.actions.navigate(ROUTES.storebenefits)} className="min-h-11 rounded-lg border border-success bg-success-surface px-3 text-left">
        <span className="block text-[10px] font-medium text-secondary">餐卡可用</span>
        <b className="block text-sm text-success-strong">¥{formatMinor(viewmodel.account.mealBalanceMinor)}</b>
      </button>
    </div>
  );
}
