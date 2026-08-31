import { ChevronRight, Coffee, CreditCard, Flame, Gift, Plus, ShieldCheck, ShoppingBag, Sparkles, Ticket, Utensils } from 'lucide-react';
import { useHomeRuntime } from '../application/HomeRuntime';
import type { MobileChannel } from '../../../shared/manifest/StorefrontChannel';
import { formatMinor } from '../../../shared/format/Money';
import { useNavigate } from 'react-router';

export function MobileHomePage({ channel }: { readonly channel: MobileChannel }) {
  const { user, presentationProducts, presentationCategories, catalogState, addToCart, homeExperience, setLaptopPage } = useHomeRuntime();
  const navigate = useNavigate();
  const products = presentationProducts.slice(0, 8);
  const categories = presentationCategories.slice(0, 8);
  return (
    <div className="space-y-3 px-3 py-3" data-experience-version={homeExperience?.version ?? 'loading'}>
      <section className={`overflow-hidden rounded-2xl p-4 text-white shadow-lg ${channel === 'android' ? 'bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500' : 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-500'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs opacity-80">{user.name}，欢迎回到福利商城</div>
            <h1 className="mt-1 text-xl font-black">企业福利，安心兑换</h1>
          </div>
          <Sparkles size={24} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setLaptopPage('orders')} className="rounded-xl bg-white/15 p-3 text-left backdrop-blur">
            <CreditCard size={18} />
            <div className="mt-2 text-[11px] opacity-80">福利卡余额</div>
            <div className="text-lg font-black">¥{formatMinor(user.welfareBalanceMinor)}</div>
          </button>
          <button type="button" onClick={() => setLaptopPage('orders')} className="rounded-xl bg-white/15 p-3 text-left backdrop-blur">
            <Utensils size={18} />
            <div className="mt-2 text-[11px] opacity-80">餐卡余额</div>
            <div className="text-lg font-black">¥{formatMinor(user.mealBalanceMinor)}</div>
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="grid grid-cols-4 gap-y-4">
          {categories.map((category, index) => {
            const icons = [Gift, ShoppingBag, Ticket, Coffee];
            const Icon = icons[index % icons.length];
            return (
              <button type="button" key={category.id} className="flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-700" onClick={() => setLaptopPage('category')}>
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${index % 2 ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                  <Icon size={20} />
                </span>
                <span className="max-w-full truncate">{category.name}</span>
              </button>
            );
          })}
          {categories.length === 0 ? (
            <div className="col-span-4 py-4 text-center text-xs text-slate-400" role="status">
              {catalogState === 'loading' ? '正在加载商品分类…' : '当前商城尚未发布分类'}
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-orange-50 to-rose-50 p-3 ring-1 ring-orange-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Flame className="text-orange-500" size={18} />
            今日福利严选
          </div>
          <button type="button" className="flex items-center text-[11px] text-slate-500" onClick={() => setLaptopPage('category')}>
            查看全部
            <ChevronRight size={14} />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">商品、价格、库存与资格均来自平台实时数据</p>
      </section>

      {products.length === 0 ? (
        <EmptyCatalog />
      ) : (
        <section className="grid grid-cols-2 gap-2.5">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
              <button type="button" className="block w-full text-left" onClick={() => void navigate(`/products/${encodeURIComponent(product.id)}`)}>
                {product.image ? (
                  <img src={product.image} alt={product.title} className="aspect-square w-full object-cover" />
                ) : (
                  <span className="grid aspect-square place-items-center bg-slate-50 text-[10px] text-slate-400">暂无商品图片</span>
                )}
                <div className="p-2.5">
                  <div className="line-clamp-2 min-h-9 text-xs font-bold leading-[18px]">{product.title}</div>
                  <div className="mt-1 flex items-center gap-1 text-[9px] text-emerald-600">
                    <ShieldCheck size={11} />
                    {product.isEnterpriseExclusive ? '企业专享商品' : '当前商城已发布'}
                  </div>
                </div>
              </button>
              <div className="flex items-center justify-between px-2.5 pb-2.5">
                <div>
                  <span className="text-[10px] text-red-500">¥</span>
                  <span className="font-black text-red-500">{product.price.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  disabled={!product.purchasable}
                  className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-white disabled:bg-slate-300"
                  onClick={() => addToCart(product)}
                  aria-label={`将${product.title}加入购物车`}
                >
                  <Plus size={16} />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function EmptyCatalog() {
  return (
    <section role="status" className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <div>
        <Gift className="mx-auto text-slate-300" size={34} />
        <div className="mt-2 text-sm font-bold">商品正在同步</div>
        <div className="mt-1 text-xs text-slate-500">登录后展示当前企业可购买商品</div>
      </div>
    </section>
  );
}
