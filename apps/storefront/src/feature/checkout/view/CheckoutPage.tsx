import { CheckSquare, Minus, Plus, ShoppingCart, Square, Trash2 } from 'lucide-react';
import { chineseDomainList } from '@shop/presentation';
import type { useCheckoutViewModel } from '../viewmodel/CheckoutViewModel';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { formatMinor } from '../../../shared/format/Money';
import { AddressPanel } from './AddressPanel';
import { OrderSummary } from './OrderSummary';
import { StorefrontStepup } from '../../security';
import { CheckoutOptions } from './CheckoutOptions';
import { CheckoutStatus } from './CheckoutStatus';

export function CheckoutPage({ viewmodel: storefront }: { readonly viewmodel: ReturnType<typeof useCheckoutViewModel> }) {
  const { selectedAddress, selected, allSelected: all, verification, actions } = storefront;
  return (
    <div className="min-h-[80vh] w-full bg-[var(--sw-background)] pb-10 font-sans">
      <StorefrontStepup open={verification} onClose={actions.closeVerification} onVerified={actions.verified} />
      <div className="sw-web-container mx-auto max-w-[1240px] space-y-3 px-3 pt-3">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-edge pb-2 text-xs">
          <h1 className="flex items-center gap-2 text-sm font-extrabold text-content">
            <ShoppingCart className="h-4 w-4 text-[var(--sw-brand)]" />
            购物车与企业福利联合结算
          </h1>
          <span className="text-muted">安全报价与结算</span>
        </header>
        <CheckoutStatus state={storefront.checkout} />
        {storefront.isLoading ? (
          <div className="rounded-lg border border-edge bg-surface p-8 text-center text-muted" role="status">
            正在读取购物车商品…
          </div>
        ) : storefront.cart.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-edge bg-surface p-8 text-center">
            <p className="text-muted">您的企采购物车内暂无商品</p>
            <button type="button" onClick={actions.browse} className="rounded-md bg-[var(--sw-brand)] px-4 py-2 text-xs font-bold text-inverse">
              选购企业福利商品
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-12">
            <div className="space-y-3 md:col-span-8">
              <section className="overflow-hidden rounded-lg border border-edge bg-surface shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge bg-subtle px-3 py-2 text-xs font-bold text-secondary">
                  <span>已加入购物车的商品</span>
                  <button type="button" onClick={() => storefront.toggleSelectAllCart(!all)} className="flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[10px] text-muted hover:bg-brand-light hover:text-brand">
                    {all ? <CheckSquare className="h-3.5 w-3.5 text-brand" /> : <Square className="h-3.5 w-3.5" />}已选 {selected.length} / {storefront.cart.length} 件
                  </button>
                </div>
                <div className="divide-y divide-edge text-xs">
                  {storefront.cart.map((item) => (
                    <article key={item.id} aria-label={item.product.title} data-checkout-item className="grid grid-cols-[44px_56px_minmax(0,1fr)] items-center gap-x-2 gap-y-3 p-3 sm:grid-cols-[44px_56px_minmax(0,1fr)_auto]">
                      <button
                        type="button"
                        onClick={() => storefront.toggleCartItemSelected(item.id)}
                        className={`grid h-11 w-11 place-items-center rounded-lg hover:bg-brand-light ${item.selected ? 'text-brand' : 'text-muted'}`}
                        aria-label={item.selected ? '取消选择' : '选择商品'}
                      >
                        {item.selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-edge bg-subtle p-1">
                        <ProductMedia source={item.product.images[0]} alt={item.product.title} className="max-h-full max-w-full object-contain" emptyClassName="text-center text-[9px] text-muted" emptyText="暂无图片" />
                      </div>
                      <div className="min-w-0 self-stretch py-0.5" data-checkout-copy>
                        <h2 className="break-words font-bold leading-5 text-content">{item.product.title}</h2>
                        <span className="mt-1 block break-words rounded bg-brand-light px-1.5 py-0.5 text-[10px] leading-4 text-[var(--sw-brand)]">
                          {item.product.allowedAccounts.length > 0 ? `已发布支付账户：${chineseDomainList(item.product.allowedAccounts)}` : '最终支付资格以服务端报价为准'}
                        </span>
                      </div>
                      <div className="col-span-2 col-start-2 flex min-w-0 items-center justify-between gap-3 text-left sm:col-span-1 sm:col-start-4 sm:block sm:min-w-[88px] sm:text-right">
                        <b className="text-price">{item.amountMinor === null ? '价格待更新' : `¥${formatMinor(item.amountMinor)}`}</b>
                        <span className="text-[10px] text-muted">购物车服务端行价</span>
                      </div>
                      <div className="col-span-2 col-start-2 flex min-w-0 items-center justify-end gap-2 sm:col-start-3">
                        <div className="flex items-center overflow-hidden rounded-lg border border-edge-strong">
                          <button
                            type="button"
                            onClick={() => storefront.updateCartQuantity(item.id, Math.max(1, item.quantity - 1))}
                            aria-label={`减少${item.product.title}数量`}
                            className="grid h-11 w-11 place-items-center bg-subtle hover:bg-brand-light"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-9 px-2 text-center font-bold">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => storefront.updateCartQuantity(item.id, item.quantity + 1)}
                            aria-label={`增加${item.product.title}数量`}
                            className="grid h-11 w-11 place-items-center bg-subtle hover:bg-brand-light"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button type="button" onClick={() => void storefront.removeCartItem(item.id)} className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-danger-surface hover:text-danger" aria-label="移除商品">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <AddressPanel
                addresses={storefront.addresses}
                address={selectedAddress}
                invoiceHeader={storefront.user.enterpriseName}
                onAddress={(id) => {
                  actions.chooseAddress(id);
                }}
                onManage={actions.manageAddresses}
                onInvoices={actions.manageInvoices}
              />
              <CheckoutOptions viewmodel={storefront.options} />
            </div>
            <OrderSummary state={storefront.checkout} selectedCount={selected.length} onSubmit={() => void actions.submit()} />
          </div>
        )}
      </div>
    </div>
  );
}
