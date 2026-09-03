import { CheckSquare, Minus, Plus, ShoppingCart, Square, Trash2 } from 'lucide-react';
import { chineseDomainList } from '@shop/presentation';
import type { useCheckoutViewModel } from '../viewmodel/CheckoutViewModel';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { formatMinor } from '../../../shared/format/Money';
import { AddressPanel } from './AddressPanel';
import { OrderSummary } from './OrderSummary';
import { StorefrontStepup } from '../../security/public';

export function CheckoutPage({ viewmodel: storefront }: { readonly viewmodel: ReturnType<typeof useCheckoutViewModel> }) {
  const { selectedAddress, selected, allSelected: all, estimateMinor, quote, verification, actions } = storefront;
  return (
    <div className="min-h-[80vh] w-full bg-[var(--sw-background)] pb-10 font-sans">
      <StorefrontStepup
        open={verification}
        onClose={actions.closeVerification}
        onVerified={actions.verified}
      />
      <div className="sw-web-container mx-auto max-w-[1240px] space-y-3 px-3 pt-3">
        <header className="flex items-center justify-between border-b border-gray-200 pb-2 text-xs">
          <h1 className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
            <ShoppingCart className="h-4 w-4 text-[var(--sw-brand)]" />
            购物车与企业福利联合结算
          </h1>
          <span className="text-gray-400">安全报价与结算</span>
        </header>
        {quote ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            最近服务端报价 {quote.quoteId}，有效期至 {new Date(quote.expiresAt).toLocaleString('zh-CN')}；提交前仍会按当前购物车重新报价。
          </div>
        ) : null}
        {storefront.isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500" role="status">
            正在读取购物车商品…
          </div>
        ) : storefront.cart.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-400">您的企采购物车内暂无商品</p>
            <button type="button" onClick={actions.browse} className="rounded-md bg-[var(--sw-brand)] px-4 py-2 text-xs font-bold text-white">
              选购企业福利商品
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-12">
            <div className="space-y-3 md:col-span-8">
              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xs">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700">
                  <span>已加入购物车的商品</span>
                  <button type="button" onClick={() => storefront.toggleSelectAllCart(!all)} className="flex items-center gap-1 text-[10px] text-gray-500">
                    {all ? <CheckSquare className="h-3.5 w-3.5 text-blue-600" /> : <Square className="h-3.5 w-3.5" />}已选 {selected.length} / {storefront.cart.length} 件
                  </button>
                </div>
                <div className="divide-y divide-gray-100 text-xs">
                  {storefront.cart.map((item) => (
                    <article key={item.id} className="flex items-center gap-3 p-3">
                      <button type="button" onClick={() => storefront.toggleCartItemSelected(item.id)} className={item.selected ? 'text-blue-600' : 'text-gray-300'} aria-label={item.selected ? '取消选择' : '选择商品'}>
                        {item.selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 p-1">
                        <ProductMedia source={item.product.images[0]} alt={item.product.title} className="max-h-full max-w-full object-contain" emptyClassName="text-center text-[9px] text-gray-400" emptyText="暂无图片" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-bold text-gray-800">{item.product.title}</h2>
                        <span className="mt-1 inline-block rounded bg-blue-50 px-1 text-[10px] text-[var(--sw-brand)]">
                          {item.product.allowedAccounts.length > 0 ? `已发布支付账户：${chineseDomainList(item.product.allowedAccounts)}` : '最终支付资格以服务端报价为准'}
                        </span>
                      </div>
                      <div className="min-w-[70px] text-right">
                        <b className="text-[var(--sw-promotion)]">¥{formatMinor(item.product.priceWelfareMinor)}</b>
                        <div className="text-[10px] text-gray-400 line-through">¥{formatMinor(item.product.priceMarketMinor)}</div>
                      </div>
                      <div className="flex items-center rounded border border-gray-300">
                        <button type="button" onClick={() => storefront.updateCartQuantity(item.id, Math.max(1, item.quantity - 1))} className="bg-gray-100 px-1.5 py-0.5">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 font-bold">{item.quantity}</span>
                        <button type="button" onClick={() => storefront.updateCartQuantity(item.id, item.quantity + 1)} className="bg-gray-100 px-1.5 py-0.5">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button type="button" onClick={() => void storefront.removeCartItem(item.id)} className="p-1 text-gray-400 hover:text-red-600" aria-label="移除商品">
                        <Trash2 className="h-4 w-4" />
                      </button>
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
            </div>
            <OrderSummary
              quote={quote}
              estimateMinor={estimateMinor}
              selectedCount={selected.length}
              submitting={storefront.isSubmittingOrder}
              onSubmit={() => void actions.submit()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
