import { CheckSquare, Minus, Plus, ShieldCheck, ShoppingCart, Square, Trash2 } from 'lucide-react';
import type { useCartViewModel } from '../viewmodel/CartViewModel';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { formatMinor } from '../../../shared/format/Money';

export function CartPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useCartViewModel> }>) {
  const { cart, selected, allSelected, estimateMinor, isLoading, failed, actions } = viewmodel;
  return (
    <div className="min-h-[80dvh] bg-[var(--sw-background)] px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-4">
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <ShoppingCart className="text-brand" />
            购物车
          </h1>
          <p className="mt-1 text-xs text-muted">此处金额为购物车估算；应付金额只以结算页服务端报价为准。</p>
        </header>
        {isLoading ? (
          <div role="status" className="grid min-h-64 place-items-center rounded-3xl border bg-surface">
            正在读取购物车…
          </div>
        ) : failed ? (
          <div role="alert" className="grid min-h-72 place-items-center rounded-3xl border border-danger bg-danger-surface p-6 text-center">
            <div>
              <h2 className="font-black text-danger">购物车商品信息读取失败</h2>
              <p className="mt-2 text-sm text-muted">购物车内容仍由服务端保留，请重试读取，系统不会将失败误判为空购物车。</p>
              <button type="button" onClick={actions.refresh} className="mt-4 min-h-11 rounded-full bg-brand px-6 font-bold text-inverse">
                重新读取
              </button>
            </div>
          </div>
        ) : cart.length === 0 ? (
          <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed bg-surface text-center">
            <div>
              <ShoppingCart className="mx-auto text-muted" size={40} />
              <h2 className="mt-3 font-black">购物车还是空的</h2>
              <button type="button" onClick={actions.browse} className="mt-4 min-h-11 rounded-full bg-brand px-6 font-bold text-inverse">
                去选商品
              </button>
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
            <section className="overflow-hidden rounded-3xl border border-edge bg-surface shadow-sm">
              <header className="flex min-h-12 items-center justify-between border-b bg-subtle px-4">
                <b>已选商品</b>
                <button type="button" onClick={() => viewmodel.toggleSelectAllCart(!allSelected)} className="flex min-h-11 items-center gap-2 text-xs font-bold">
                  {allSelected ? <CheckSquare className="text-brand" size={17} /> : <Square size={17} />}全选（{selected.length}/{cart.length}）
                </button>
              </header>
              <div className="divide-y">
                {cart.map((item) => (
                  <article key={item.id} className="flex flex-wrap items-center gap-3 p-4">
                    <button type="button" disabled={item.validity.state === 'invalid'} onClick={() => viewmodel.toggleCartItemSelected(item.id)} aria-label={item.selected ? '取消选择商品' : '选择商品'} className="grid h-11 w-11 place-items-center disabled:cursor-not-allowed disabled:opacity-40">
                      {item.selected ? <CheckSquare className="text-brand" /> : <Square className="text-muted" />}
                    </button>
                    <ProductMedia source={item.product.images[0]} alt={item.title} className="h-20 w-20 rounded-xl object-cover" emptyClassName="grid h-20 w-20 place-items-center rounded-xl bg-subtle text-[10px] text-muted" />
                    <div className="min-w-[160px] flex-1">
                      <h2 className="line-clamp-2 text-sm font-bold">{item.title}</h2>
                      <span className={`mt-2 flex items-center gap-1 text-[10px] ${item.validity.state === 'valid' ? 'text-success-strong' : 'text-warning-strong'}`}>
                        <ShieldCheck size={12} />
                        {item.validity.message}
                      </span>
                      {item.benefitApplicable ? <span className="mt-1 inline-flex rounded-full bg-success-surface px-2 py-0.5 text-[10px] font-bold text-success-strong">福利权益适用</span> : null}
                      <b className="mt-2 block text-danger">{item.amountMinor === null ? '价格待更新' : `¥${formatMinor(item.amountMinor)}`}</b>
                    </div>
                    <div className="flex overflow-hidden rounded-xl border">
                      <button type="button" onClick={() => viewmodel.updateCartQuantity(item.id, item.quantity - 1)} aria-label={`减少${item.title}数量`} className="grid h-11 w-11 place-items-center">
                        <Minus size={14} />
                      </button>
                      <span className="grid min-w-11 place-items-center border-x font-bold">{item.quantity}</span>
                      <button type="button" disabled={item.validity.state === 'invalid' || (item.available !== null && item.quantity >= item.available)} onClick={() => viewmodel.updateCartQuantity(item.id, item.quantity + 1)} aria-label={`增加${item.title}数量`} className="grid h-11 w-11 place-items-center disabled:cursor-not-allowed disabled:opacity-40">
                        <Plus size={14} />
                      </button>
                    </div>
                    <button type="button" onClick={() => void viewmodel.removeCartItem(item.id)} aria-label="移除商品" className="grid h-11 w-11 place-items-center text-muted hover:text-danger">
                      <Trash2 size={18} />
                    </button>
                  </article>
                ))}
              </div>
            </section>
            <aside className="rounded-3xl border border-edge bg-surface p-5 shadow-sm lg:sticky lg:top-24">
              <h2 className="text-lg font-black">费用估算</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt>已选商品</dt>
                  <dd>{selected.length} 件</dd>
                </div>
                <div className="flex justify-between border-t pt-4">
                  <dt className="font-black">当前估算</dt>
                  <dd className="text-xl font-black text-danger">¥{formatMinor(estimateMinor)}</dd>
                </div>
              </dl>
              <p className="mt-3 rounded-xl bg-warning-surface p-3 text-xs leading-5 text-warning-strong">运费、优惠、卡券、福利账户及最终应付由下一步服务端报价逐项列明。</p>
              <button type="button" disabled={selected.length === 0} onClick={actions.checkout} className="mt-4 min-h-12 w-full rounded-2xl bg-brand font-black text-inverse disabled:bg-disabled">
                去安全结算
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
