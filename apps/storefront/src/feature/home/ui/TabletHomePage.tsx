import { ChevronRight, CreditCard, Gift, Plus, Search, ShieldCheck, ShoppingCart, Sparkles, Utensils } from 'lucide-react';
import { useHomeRuntime } from '../application/HomeRuntime';
import { useNavigate } from 'react-router';
import { formatMinor } from '../../../shared/format/Money';

export function TabletHomePage() {
  const { user, currentMall, presentationProducts, presentationCategories, addToCart, setLaptopPage, homeExperience, presentationOrders } = useHomeRuntime();
  const navigate = useNavigate();
  return (
    <div className="p-5" data-experience-version={homeExperience?.version ?? 'loading'}>
      <div className="mx-auto max-w-6xl space-y-4">
        <label className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm">
          <Search size={19} className="text-slate-400" />
          <input className="min-w-0 flex-1 outline-none" placeholder="搜索企业福利商品、品牌或分类" onFocus={() => setLaptopPage('category')} />
        </label>
        <section className="storefronttabletlayout grid gap-4">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/75">{currentMall.welcomeBanner}</p>
                <h1 className="mt-2 text-3xl font-black">智慧翼企业福利商城</h1>
                <p className="mt-2 max-w-xl text-sm text-white/80">已发布商城版本 {homeExperience?.version ?? '同步中'}，价格、库存、资格实时校验。</p>
              </div>
              <Sparkles size={36} />
            </div>
            <button type="button" onClick={() => setLaptopPage('category')} className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-black text-blue-700">
              开始选购
            </button>
          </div>
          <aside className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 border-b pb-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 font-black text-blue-600">{user.name.slice(0, 1)}</span>
              <div>
                <div className="font-black">{user.name}</div>
                <div className="text-xs text-slate-400">{user.department}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="rounded-2xl bg-blue-50 p-3 text-left" onClick={() => setLaptopPage('orders')}>
                <CreditCard size={18} className="text-blue-600" />
                <div className="mt-2 text-[10px] text-slate-500">福利卡</div>
                <b>¥{formatMinor(user.welfareBalanceMinor)}</b>
              </button>
              <button type="button" className="rounded-2xl bg-amber-50 p-3 text-left" onClick={() => setLaptopPage('orders')}>
                <Utensils size={18} className="text-amber-600" />
                <div className="mt-2 text-[10px] text-slate-500">餐卡</div>
                <b>¥{formatMinor(user.mealBalanceMinor)}</b>
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span>近期订单</span>
              <b>{presentationOrders.length}</b>
            </div>
          </aside>
        </section>
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="storefronttabletcategories grid grid-cols-4 gap-3">
            {presentationCategories.slice(0, 8).map((category, index) => (
              <button type="button" key={category.id} onClick={() => setLaptopPage('category')} className="flex flex-col items-center gap-2 rounded-2xl p-2 text-xs font-bold hover:bg-slate-50">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${index % 2 ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                  <Gift size={22} />
                </span>
                {category.name}
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">企业严选</h2>
              <p className="text-xs text-slate-500">当前账号可见、可购商品</p>
            </div>
            <button type="button" onClick={() => setLaptopPage('category')} className="flex items-center text-xs text-blue-600">
              更多
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="storefronttabletproducts grid grid-cols-3 gap-3">
            {presentationProducts.slice(0, 8).map((product) => (
              <article key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <button type="button" className="w-full text-left" onClick={() => void navigate(`/products/${encodeURIComponent(product.id)}`)}>
                  {product.image ? (
                    <img src={product.image} alt={product.title} className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <span className="grid aspect-[4/3] place-items-center bg-slate-50 text-[10px] text-slate-400">暂无商品图片</span>
                  )}
                  <div className="p-3">
                    <h3 className="line-clamp-2 min-h-10 text-sm font-bold">{product.title}</h3>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600">
                      <ShieldCheck size={12} />
                      {product.isEnterpriseExclusive ? '企业专享' : '当前商城已发布'}
                    </div>
                  </div>
                </button>
                <div className="flex items-center justify-between px-3 pb-3">
                  <b className="text-red-500">¥{product.price.toFixed(2)}</b>
                  <button type="button" disabled={!product.purchasable} className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white disabled:bg-slate-300" onClick={() => addToCart(product)} aria-label="加入购物车">
                    <Plus size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {presentationProducts.length === 0 ? (
            <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed bg-white text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <ShoppingCart size={20} />
                商品同步中
              </span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
