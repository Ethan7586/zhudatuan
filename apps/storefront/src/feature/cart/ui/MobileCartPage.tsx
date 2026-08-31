import { CheckSquare, CreditCard, Minus, Plus, ShieldCheck, ShoppingBag, Square, Trash2 } from 'lucide-react';
import { useCartRuntime } from '../application/CartRuntime';
import type { MobileChannel } from '../../../shared/manifest/StorefrontChannel';
import { formatMinor } from '../../../shared/format/Money';

export function MobileCartPage({ channel }: { readonly channel: MobileChannel }) {
  const { cart, isLoading, toggleCartItemSelected, toggleSelectAllCart, updateCartQuantity, removeCartItem, navigateTo, user } = useCartRuntime();
  const selected = cart.filter((item) => item.selected);
  const totalMinor = selected.reduce((sum, item) => sum + item.product.priceWelfareMinor * item.quantity, 0);
  const all = cart.length > 0 && selected.length === cart.length;
  return (
    <div className="min-h-[70dvh] pb-24">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-black">
          购物车 <span className="text-xs font-normal text-slate-400">({cart.length})</span>
        </h1>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] text-blue-600">{channel === 'android' ? '安全结算' : '小程序结算'}</span>
      </div>
      {isLoading ? (
        <div className="grid min-h-80 place-items-center text-sm text-slate-500" role="status">
          正在读取购物车商品…
        </div>
      ) : cart.length === 0 ? (
        <div className="grid min-h-80 place-items-center text-center">
          <div>
            <ShoppingBag className="mx-auto text-slate-300" size={46} />
            <h2 className="mt-3 font-bold">购物车还是空的</h2>
            <p className="mt-1 text-xs text-slate-500">去挑选企业福利商品吧</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 px-3">
          {cart.map((item) => (
            <article key={item.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <button type="button" onClick={() => toggleCartItemSelected(item.id)} className={item.selected ? 'text-blue-600' : 'text-slate-300'} aria-label={item.selected ? '取消选择' : '选择商品'}>
                {item.selected ? <CheckSquare size={20} /> : <Square size={20} />}
              </button>
              {item.product.images[0] ? (
                <img src={item.product.images[0]} alt={item.product.title} className="h-20 w-20 rounded-xl object-cover" />
              ) : (
                <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-slate-100 text-[10px] text-slate-400">暂无图片</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-xs font-bold leading-5">{item.product.title}</div>
                <div className="mt-1 text-[10px] text-slate-400">SKU：{item.skuId}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-black text-red-500">¥{formatMinor(item.product.priceWelfareMinor)}</span>
                  <div className="flex items-center rounded-lg border">
                    <button type="button" className="grid h-7 w-7 place-items-center" onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>
                      <Minus size={12} />
                    </button>
                    <span className="grid h-7 min-w-7 place-items-center border-x text-[11px]">{item.quantity}</span>
                    <button type="button" className="grid h-7 w-7 place-items-center" onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
              <button type="button" className="self-start text-slate-300" onClick={() => void removeCartItem(item.id)} aria-label="移除商品">
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
      <section className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black">
          <CreditCard size={18} className="text-blue-600" />
          福利账户支付
        </div>
        <div className="mt-3 flex justify-between text-xs text-slate-500">
          <span>福利卡可用</span>
          <b className="text-slate-900">¥{formatMinor(user.welfareBalanceMinor)}</b>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600">
          <ShieldCheck size={12} />
          金额以服务端一致性结算上下文为准
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-[57px] z-40 mx-auto flex max-w-[767px] items-center gap-3 border-t bg-white p-3">
        <button type="button" onClick={() => toggleSelectAllCart(!all)} className="flex items-center gap-1 text-xs">
          {all ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-slate-400" />}全选
        </button>
        <div className="min-w-0 flex-1 text-right">
          <div className="text-[10px] text-slate-400">合计</div>
          <div className="font-black text-red-500">¥{formatMinor(totalMinor)}</div>
        </div>
        <button type="button" disabled={selected.length === 0} onClick={() => navigateTo('checkout')} className="h-11 rounded-full bg-blue-600 px-6 text-sm font-black text-white disabled:bg-slate-300">
          结算({selected.length})
        </button>
      </div>
    </div>
  );
}
