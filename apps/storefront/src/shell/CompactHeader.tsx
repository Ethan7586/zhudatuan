import { Bell, ShoppingCart } from 'lucide-react';
import { Brand } from '@shop/design';
import type { ShellQuickAction } from './ShellNavigation';
import type { ShellViewModel } from './ShellViewModel';
import { HeaderSearch } from './HeaderSearch';

export function CompactHeader({ viewmodel }: Readonly<{ viewmodel: ShellViewModel }>) {
  const notifications = viewmodel.navigation.quick.find(({ kind }) => kind === 'notification');
  const cart = viewmodel.navigation.quick.find(({ kind }) => kind === 'cart');
  return (
    <header data-storefront-shell="mobile" className="sticky top-0 z-40 bg-gradient-to-br from-brand via-brand-dark to-brand-ink text-inverse shadow-md lg:hidden">
      <div className="mx-auto max-w-lg px-3 pb-3 pt-[max(.55rem,env(safe-area-inset-top))]">
        <div className="flex min-h-11 items-center gap-2">
          <button type="button" onClick={viewmodel.actions.home} className="min-h-11 min-w-0 flex-1 text-left" aria-label={`返回${viewmodel.brand.name}首页`}>
            <Brand variant="mark" product={viewmodel.brand.name} inverse />
          </button>
          {notifications ? <MobileAction action={notifications} cartCount={viewmodel.cartCount} navigate={viewmodel.actions.navigate} /> : null}
          {cart ? <MobileAction action={cart} cartCount={viewmodel.cartCount} navigate={viewmodel.actions.navigate} /> : null}
        </div>
        {viewmodel.navigation.search ? <HeaderSearch search={viewmodel.actions.search} mobile /> : null}
        {viewmodel.navigation.published.length ? (
          <nav aria-label="商城专属频道" className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
            {viewmodel.navigation.published.map((item) => (
              <button type="button" key={item.id} onClick={() => viewmodel.actions.navigate(item.path)} className="min-h-11 shrink-0 whitespace-nowrap rounded-full bg-surface/12 px-3 text-xs font-bold text-inverse hover:bg-surface/20">
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}

function MobileAction({ action, cartCount, navigate }: Readonly<{ action: ShellQuickAction; cartCount: number; navigate: (path: string) => void }>) {
  const label = action.kind === 'cart' ? `${action.label}，共 ${cartCount} 件` : action.label;
  const Icon = action.kind === 'notification' ? Bell : ShoppingCart;
  return (
    <button type="button" onClick={() => navigate(action.path)} aria-label={label} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-inverse hover:bg-surface/15">
      <Icon size={20} aria-hidden="true" />
      {action.kind === 'cart' && cartCount > 0 ? <CartCount count={cartCount} /> : null}
    </button>
  );
}

export function CartCount({ count }: Readonly<{ count: number }>) {
  return (
    <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-inverse" aria-hidden="true">
      {count > 99 ? '99+' : count}
    </span>
  );
}
