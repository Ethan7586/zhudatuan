import { Bell, Menu, Search, ShoppingCart, UserRound } from 'lucide-react';
import { Brand } from '@shop/design';
import type { ReactNode } from 'react';
import type { useShellViewModel } from './ShellViewModel';
import { QuickView } from './QuickView';
import { ToastContainer } from '../shared/view/ToastContainer';

export function StorefrontShell({ viewmodel, children }: Readonly<{ viewmodel: ReturnType<typeof useShellViewModel>; children: ReactNode }>) {
  return (
    <div className="min-h-dvh bg-[var(--sw-background)] text-content">
      <a href="#storefront-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-surface focus:p-3">
        跳到主要内容
      </a>
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1280px] items-center gap-3 px-3 sm:px-5">
          <button type="button" onClick={viewmodel.actions.home} className="flex min-h-11 shrink-0 items-center gap-2 font-black text-brand-dark">
            <Brand variant="mark" product="福利商城" />
          </button>
          <form
            className="mx-auto hidden max-w-xl flex-1 items-center rounded-full border border-edge-strong bg-subtle px-4 md:flex"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get('query');
              viewmodel.actions.search(typeof value === 'string' ? value : '');
            }}
          >
            <Search size={17} className="text-muted" />
            <input name="query" aria-label="搜索商城商品" className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" placeholder="搜索商品、品牌或分类" />
          </form>
          <nav aria-label="快捷导航" className="flex items-center gap-1">
            <button type="button" onClick={viewmodel.actions.notifications} aria-label="消息通知" className="grid h-11 w-11 place-items-center rounded-full hover:bg-subtle">
              <Bell size={19} />
            </button>
            <button type="button" onClick={viewmodel.actions.cart} aria-label={`购物车，共 ${viewmodel.cartCount} 件`} className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-subtle">
              <ShoppingCart size={19} />
              {viewmodel.cartCount ? <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-inverse">{viewmodel.cartCount}</span> : null}
            </button>
            <button type="button" onClick={viewmodel.actions.profile} aria-label="个人中心" className="grid h-11 w-11 place-items-center rounded-full hover:bg-subtle">
              <UserRound size={19} />
            </button>
          </nav>
        </div>
        <div className="mx-auto flex max-w-[1280px] gap-1 overflow-auto px-3 pb-2 sm:px-5" aria-label="商城导航">
          {[...viewmodel.navigation]
            .filter(({ experience }) => experience.placement === 'primary' && !experience.disabled)
            .sort((a, b) => a.order - b.order)
            .map((item) => (
              <button type="button" key={item.key} onClick={() => viewmodel.actions.navigate(item.experience.route)} className="min-h-10 whitespace-nowrap rounded-xl px-3 text-xs font-bold hover:bg-brand-light">
                {item.title}
              </button>
            ))}
          <button type="button" onClick={viewmodel.actions.catalog} className="ml-auto min-h-10 whitespace-nowrap rounded-xl px-3 text-xs font-bold md:hidden">
            <Menu size={15} className="mr-1 inline" />
            全部商品
          </button>
        </div>
      </header>
      <main id="storefront-content" tabIndex={-1}>
        {children}
      </main>
      <QuickView />
      <ToastContainer toasts={viewmodel.toasts} removeToast={viewmodel.removeToast} />
      <footer className="mt-8 border-t bg-brand-ink px-4 py-8 text-center text-xs leading-6 text-[var(--sw-inverse-label)]">
        <b className="text-inverse">智慧翼企业福利商城</b>
        <p className="text-inverse-label">价格、库存、资格、订单与权益状态以服务端权威记录为准。</p>
        <p className="text-inverse-label">如需帮助，请进入客服中心；请勿通过非官方渠道提供验证码或密码。</p>
      </footer>
    </div>
  );
}
