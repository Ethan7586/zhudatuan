import { CheckSquare, CreditCard, Minus, Plus, ShieldCheck, Square, Trash2 } from 'lucide-react';
import { useCartRuntime } from '../application/CartRuntime';
import { formatMinor } from '../../../shared/format/Money';

export function TabletCartPage() {
  const { cart, isLoading, user, addresses, toggleCartItemSelected, toggleSelectAllCart, updateCartQuantity, removeCartItem, navigateTo } = useCartRuntime();
  const selected = cart.filter((item) => item.selected);
  const totalMinor = selected.reduce((sum, item) => sum + item.product.priceWelfareMinor * item.quantity, 0);
  const all = cart.length > 0 && selected.length === cart.length;
  return (
    <div className="mx-auto max-w-6xl p-5">
      <div className="mb-4">
        <h1 className="text-xl font-black">购物车与安全结算</h1>
        <p className="text-xs text-slate-500">结算信息由单次一致性上下文返回</p>
      </div>
      <div className="storefronttabletcheckout grid gap-4">
        <section className="space-y-3">
          {isLoading ? (
            <div className="grid min-h-64 place-items-center rounded-2xl bg-white text-slate-500" role="status">
              正在读取购物车商品…
            </div>
          ) : (
            cart.map((item) => (
              <article key={item.id} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <button type="button" onClick={() => toggleCartItemSelected(item.id)} className={item.selected ? 'text-blue-600' : 'text-slate-300'}>
                  {item.selected ? <CheckSquare /> : <Square />}
                </button>
                {item.product.images[0] ? (
                  <img src={item.product.images[0]} alt={item.product.title} className="h-24 w-24 rounded-xl object-cover" />
                ) : (
                  <span className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-slate-100 text-[10px] text-slate-400">暂无图片</span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-sm font-bold">{item.product.title}</h2>
                  <p className="mt-1 text-xs text-slate-400">SKU：{item.skuId}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <b className="text-red-500">¥{formatMinor(item.product.priceWelfareMinor)}</b>
                    <div className="flex overflow-hidden rounded-lg border">
                      <button type="button" className="grid h-8 w-8 place-items-center" onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>
                        <Minus size={13} />
                      </button>
                      <span className="grid min-w-9 place-items-center border-x text-xs">{item.quantity}</span>
                      <button type="button" className="grid h-8 w-8 place-items-center" onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => void removeCartItem(item.id)} className="text-slate-300" aria-label="移除">
                  <Trash2 size={17} />
                </button>
              </article>
            ))
          )}
          {!isLoading && cart.length === 0 ? <div className="grid min-h-64 place-items-center rounded-2xl bg-white text-slate-500">购物车暂无商品</div> : null}
        </section>
        <aside className="space-y-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-black">收货信息</h2>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {addresses[0] ? `${addresses[0].recipient} ${addresses[0].mobile}\n${addresses[0].province}${addresses[0].city}${addresses[0].district}${addresses[0].detail}` : '请先在个人中心维护收货地址'}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-black">
              <CreditCard size={18} className="text-blue-600" />
              福利支付
            </h2>
            <div className="mt-3 flex justify-between text-xs">
              <span>福利卡可用</span>
              <b>¥{formatMinor(user.welfareBalanceMinor)}</b>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[10px] text-emerald-600">
              <ShieldCheck size={13} />
              服务端校验价格、库存和资格
            </div>
            <div className="mt-5 flex justify-between">
              <button type="button" onClick={() => toggleSelectAllCart(!all)} className="flex items-center gap-1 text-xs">
                {all ? <CheckSquare size={17} className="text-blue-600" /> : <Square size={17} />}全选
              </button>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">合计</div>
                <b className="text-xl text-red-500">¥{formatMinor(totalMinor)}</b>
              </div>
            </div>
            <button type="button" disabled={selected.length === 0} onClick={() => navigateTo('checkout')} className="mt-4 h-12 w-full rounded-2xl bg-blue-600 font-black text-white disabled:bg-slate-300">
              进入结算（{selected.length}）
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
