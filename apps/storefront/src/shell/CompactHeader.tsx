import { Bell, Building2, ChevronDown, ShoppingCart } from 'lucide-react';
import { Brand } from '@shop/design';
import type { ShellQuickAction } from './ShellNavigation';
import type { ShellViewModel } from './ShellViewModel';
import { HeaderSearch } from './HeaderSearch';
import { shellPathActive } from './ShellNavigation';

export function CompactHeader({ viewmodel }: Readonly<{ viewmodel: ShellViewModel }>) {
  const landing =
    viewmodel.pathname === '/' || viewmodel.navigation.published.some(({ path }) => shellPathActive(viewmodel.pathname, path));
  if (!landing) return null;
  const notifications = viewmodel.navigation.quick.find(({ kind }) => kind === 'notification');
  const cart = viewmodel.navigation.quick.find(({ kind }) => kind === 'cart');
  return (
    <header data-storefront-shell="mobile" data-storefront-mobile-home className="sticky top-0 z-40 border-b border-edge bg-surface text-content shadow-sm lg:hidden">
      <div className="mx-auto max-w-[512px] px-[12px] pb-[10px] pt-[max(8px,env(safe-area-inset-top))]">
        <div className="flex min-h-[44px] items-center gap-[8px]">
          <button type="button" data-visual-copy="multiline" onClick={viewmodel.actions.home} className="storefrontbrandhome flex min-h-[44px] min-w-0 flex-1 items-center py-[4px] text-left" aria-label={`返回${viewmodel.brand.name}首页`}>
            <Brand variant="mark" product={viewmodel.brand.name} />
          </button>
          {notifications ? <MobileAction action={notifications} cartCount={viewmodel.cartCount} navigate={viewmodel.actions.navigate} /> : null}
          {cart ? <MobileAction action={cart} cartCount={viewmodel.cartCount} navigate={viewmodel.actions.navigate} /> : null}
        </div>
        <MobileMallSwitcher viewmodel={viewmodel} />
        {viewmodel.navigation.search ? <HeaderSearch search={viewmodel.actions.search} mobile /> : null}
        {viewmodel.navigation.published.length ? (
          <nav aria-label="商城专属频道" className="mt-[8px] flex gap-[8px] overflow-x-auto pb-[2px]">
            {viewmodel.navigation.published.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => viewmodel.actions.navigate(item.path)}
                className="min-h-[44px] shrink-0 whitespace-nowrap rounded-full bg-brand-faint px-[12px] text-xs font-bold text-brand-dark hover:bg-brand-light"
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}

function MobileMallSwitcher({ viewmodel }: Readonly<{ viewmodel: ShellViewModel }>) {
  const malls = viewmodel.account.malls;
  if (malls.length <= 1) {
    return (
      <div aria-label="当前企业福利商城" className="mt-[6px] flex min-h-[44px] min-w-0 items-center gap-2 rounded-xl bg-subtle px-3 text-xs">
        <Building2 size={16} className="shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-bold">{viewmodel.brand.enterprise}</span>
        <span className="shrink-0 rounded-full bg-brand-light px-2 py-1 text-[10px] font-bold text-brand-dark">当前商城</span>
      </div>
    );
  }
  return (
    <details className="group relative mt-[6px]">
      <summary aria-label="当前企业福利商城" className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-xl bg-subtle px-3 text-xs hover:bg-brand-faint">
        <Building2 size={16} className="shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-bold">{viewmodel.brand.enterprise}</span>
        <span className="shrink-0 text-[10px] font-bold text-brand">切换商城</span>
        <ChevronDown size={14} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="absolute inset-x-0 top-[48px] z-50 grid gap-1 rounded-xl border border-edge bg-surface p-2 shadow-xl">
        {malls.map((mall) => (
          <button
            type="button"
            key={mall.membershipId ?? mall.id}
            disabled={mall.id === viewmodel.account.currentMall.id || !mall.membershipId}
            onClick={() => mall.membershipId && viewmodel.actions.switchMall(mall.membershipId)}
            className="flex min-h-[44px] min-w-0 items-center justify-between gap-3 rounded-lg px-3 text-left text-xs hover:bg-subtle disabled:bg-brand-light disabled:text-brand-dark"
          >
            <span className="min-w-0 truncate font-bold">{mall.mallName}</span>
            <span className="shrink-0">{mall.id === viewmodel.account.currentMall.id ? '当前' : '切换'}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

function MobileAction({ action, cartCount, navigate }: Readonly<{ action: ShellQuickAction; cartCount: number; navigate: (path: string) => void }>) {
  const label = action.kind === 'cart' ? `${action.label}，共 ${cartCount} 件` : action.label;
  const Icon = action.kind === 'notification' ? Bell : ShoppingCart;
  return (
    <button type="button" onClick={() => navigate(action.path)} aria-label={label} className="relative grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full text-content hover:bg-subtle">
      <Icon size={20} className="text-brand-dark" aria-hidden="true" />
      {action.kind === 'cart' && cartCount > 0 ? <CartCount count={cartCount} /> : null}
    </button>
  );
}

export function CartCount({ count }: Readonly<{ count: number }>) {
  return (
    <span className="absolute right-0 top-0 grid h-[20px] min-w-[20px] place-items-center rounded-full bg-danger px-[4px] text-[10px] font-bold text-inverse" aria-hidden="true">
      {count > 99 ? '99+' : count}
    </span>
  );
}
