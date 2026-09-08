import { Bell, ChevronDown, Headphones, LogOut, Menu, Search, ShoppingCart, UserRound } from 'lucide-react';
import { Brand } from '@shop/design';
import type { ReactNode } from 'react';
import type { useShellViewModel } from './ShellViewModel';
import type { ShellQuickAction } from './ShellNavigation';
import { QuickView } from './QuickView';
import { ToastContainer } from '../shared/view/ToastContainer';
import { responsivePattern } from '../shared/view/ResponsivePattern';

export function StorefrontShell({ viewmodel, children }: Readonly<{ viewmodel: ReturnType<typeof useShellViewModel>; children: ReactNode }>) {
  return (
    <div className="min-h-dvh bg-[var(--sw-background)] text-content">
      <a href="#storefront-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-surface focus:p-3">
        跳到主要内容
      </a>
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/95 backdrop-blur">
        <div className={`${responsivePattern.frame} ${responsivePattern.gutter} flex min-h-16 items-center gap-3`}>
          <button type="button" onClick={viewmodel.actions.home} className="flex min-h-11 shrink-0 items-center gap-2 font-black text-brand-dark" aria-label={`返回${viewmodel.brand.name}首页`}>
            <Brand variant="mark" product={viewmodel.brand.name} />
          </button>
          {viewmodel.navigation.search ? <form
            className="mx-auto hidden max-w-xl flex-1 items-center rounded-full border border-edge-strong bg-subtle px-4 md:flex focus-within:border-brand focus-within:ring-2 focus-within:ring-focus/30"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get('query');
              viewmodel.actions.search(typeof value === 'string' ? value : '');
            }}
          >
            <Search size={17} className="text-muted" />
            <input name="query" aria-label="搜索商城商品" className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" placeholder="搜索商品、品牌或分类" />
          </form> : <div className="mx-auto flex-1" />}
          <nav aria-label="快捷导航" className="flex items-center gap-1">
            {viewmodel.navigation.quick.filter(({ kind }) => kind !== 'account').map((action) => (
              <QuickAction key={action.id} action={action} cartCount={viewmodel.cartCount} navigate={viewmodel.actions.navigate} />
            ))}
            {viewmodel.navigation.quick.some(({ kind }) => kind === 'account') ? <AccountMenu viewmodel={viewmodel} /> : null}
          </nav>
        </div>
        <nav className={`${responsivePattern.frame} ${responsivePattern.gutter} flex gap-1 overflow-auto pb-2`} aria-label="商城导航">
          {[...viewmodel.navigation.primary, ...viewmodel.navigation.published].map((item) => (
              <button type="button" key={item.id} onClick={() => viewmodel.actions.navigate(item.path)} className="min-h-11 whitespace-nowrap rounded-xl px-3 text-xs font-bold hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                {item.label}
              </button>
            ))}
          {viewmodel.navigation.search ? <button type="button" onClick={viewmodel.actions.catalog} className="ml-auto min-h-11 whitespace-nowrap rounded-xl px-3 text-xs font-bold md:hidden">
            <Menu size={15} className="mr-1 inline" />
            全部商品
          </button> : null}
        </nav>
      </header>
      <main id="storefront-content" tabIndex={-1}>
        {children}
      </main>
      <QuickView enabled={viewmodel.navigation.quickView} />
      <ToastContainer toasts={viewmodel.toasts} removeToast={viewmodel.removeToast} />
      <footer className="mt-8 border-t bg-brand-ink px-4 py-8 text-center text-xs leading-6 text-[var(--sw-inverse-label)]">
        <b className="text-inverse">智慧翼企业福利商城</b>
        <p className="text-inverse-label">价格、库存、资格、订单与权益状态以服务端权威记录为准。</p>
        <p className="text-inverse-label">如需帮助，请进入客服中心；请勿通过非官方渠道提供验证码或密码。</p>
      </footer>
    </div>
  );
}

function QuickAction({ action, cartCount, navigate }: Readonly<{ action: ShellQuickAction; cartCount: number; navigate: (path: string) => void }>) {
  const label = action.kind === 'cart' ? `${action.label}，共 ${cartCount} 件` : action.label;
  const Icon = action.kind === 'support' ? Headphones : action.kind === 'notification' ? Bell : ShoppingCart;
  return (
    <button type="button" onClick={() => navigate(action.path)} aria-label={label} className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      <Icon size={19} aria-hidden="true" />
      {action.kind === 'cart' && cartCount > 0 ? <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-inverse" aria-hidden="true">{cartCount > 99 ? '99+' : cartCount}</span> : null}
    </button>
  );
}

function AccountMenu({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useShellViewModel> }>) {
  const account = viewmodel.navigation.quick.find(({ kind }) => kind === 'account')!;
  return (
    <details className="group relative">
      <summary aria-label={viewmodel.account.authenticated ? `${viewmodel.account.name}的账户菜单` : account.label} className="flex h-11 cursor-pointer list-none items-center gap-1 rounded-full px-3 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <UserRound size={19} aria-hidden="true" />
        <span className="hidden max-w-24 truncate text-xs font-bold sm:inline">{viewmodel.account.name}</span>
        <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-edge bg-surface p-2 shadow-xl">
        <button type="button" onClick={() => viewmodel.actions.navigate(account.path)} className="w-full rounded-xl px-3 py-3 text-left hover:bg-subtle">
          <strong className="block text-sm text-content">{viewmodel.account.name}</strong>
          <span className="mt-1 block truncate text-xs text-muted">{viewmodel.brand.enterprise} · {viewmodel.brand.badge}</span>
        </button>
        {viewmodel.account.malls.length > 1 ? <div className="mt-1 border-t border-edge px-1 pt-2">
          <p className="px-2 pb-1 text-[11px] font-bold text-muted">切换福利商城</p>
          {viewmodel.account.malls.map((mall) => (
            <button type="button" key={mall.membershipId ?? mall.id} disabled={mall.id === viewmodel.account.currentMall.id} onClick={() => mall.membershipId && viewmodel.actions.switchMall(mall.membershipId)} className="flex min-h-10 w-full items-center justify-between rounded-lg px-2 text-left text-xs hover:bg-subtle disabled:cursor-default disabled:bg-brand-light disabled:text-brand-dark">
              <span className="truncate">{mall.mallName}</span><span>{mall.id === viewmodel.account.currentMall.id ? '当前' : '切换'}</span>
            </button>
          ))}
        </div> : null}
        {viewmodel.account.authenticated ? <button type="button" onClick={() => void viewmodel.actions.logout()} className="mt-1 flex min-h-10 w-full items-center gap-2 border-t border-edge px-3 pt-2 text-left text-xs font-bold text-danger-strong hover:bg-danger-surface">
          <LogOut size={16} aria-hidden="true" />安全退出
        </button> : null}
      </div>
    </details>
  );
}
