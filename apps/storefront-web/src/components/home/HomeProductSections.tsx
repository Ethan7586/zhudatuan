import React from 'react';
import { ChevronRight, Flame, PackageSearch, ShoppingBag, Sparkles } from 'lucide-react';
import { useMall } from '../../context/MallContext';
import { ProductCard } from '../common/ProductCard';

export const HomeProductSections: React.FC = () => {
  const { navigateTo, products } = useMall();
  const enterpriseExclusives = products.filter((p) => p.isEnterpriseExclusive).slice(0, 5);
  const recommended = products.filter((p) => p.stock > 0 || p.isNewArrival || p.isHotRedeem).slice(0, 5);
  const catalogFallback = products.slice(0, 5);
  const categories = [
    {
      id: 'cat_food',
      title: '食品饮料与粮油',
      detail: '米面粮油 · 茶饮零食',
      tone: 'text-emerald-600',
      tag: '餐卡可用',
    },
    {
      id: 'cat_appliance',
      title: '家用电器',
      detail: '厨房小电 · 生活电器',
      tone: 'text-blue-600',
      tag: '家庭焕新',
    },
    {
      id: 'cat_digital',
      title: '数码办公',
      detail: '电脑外设 · 商务办公',
      tone: 'text-indigo-600',
      tag: '品质办公',
    },
    {
      id: 'cat_home',
      title: '家居日用',
      detail: '家纺厨具 · 收纳清洁',
      tone: 'text-amber-600',
      tag: '居家优选',
    },
    {
      id: 'cat_personal',
      title: '个护清洁',
      detail: '洗护美妆 · 日常清洁',
      tone: 'text-rose-600',
      tag: '健康关怀',
    },
    {
      id: 'cat_apparel',
      title: '服饰鞋包',
      detail: '鞋靴服饰 · 箱包配饰',
      tone: 'text-fuchsia-600',
      tag: '品质穿搭',
    },
    {
      id: 'cat_supermarket',
      title: '商超商品',
      detail: '文具玩具 · 宠物户外',
      tone: 'text-cyan-600',
      tag: '生活好物',
    },
    {
      id: 'cat_welfare_zone',
      title: '企业福利专区',
      detail: '员工关怀 · 节日礼赠',
      tone: 'text-purple-600',
      tag: '企业专享',
    },
  ].filter((category) => products.some((product) => product.categoryId === category.id));
  return (
    <>
      {/* 模块 1：企业专享价 & 今日特惠双侧碰撞栏 */}
      <div className="max-w-[1280px] mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 企业专享价 */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[var(--sw-brand-dark)] text-white flex items-center justify-center font-bold text-xs">企</div>
              <div>
                <h2 className="text-base font-bold text-gray-900">企业专享价专区</h2>
                <p className="text-[11px] text-gray-400">集团大客户采购协议价补贴</p>
              </div>
            </div>
            <button onClick={() => navigateTo('category', { categoryId: 'cat_welfare_zone' })} className="text-xs text-[var(--sw-brand)] font-semibold hover:underline flex items-center gap-0.5">
              更多专享 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {enterpriseExclusives.slice(0, 2).map((p) => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </div>

        {/* 全量商品目录 */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#FF7A00] text-white flex items-center justify-center font-bold text-xs">全</div>
              <div>
                <h2 className="text-base font-bold text-gray-900">全量商品目录</h2>
                <p className="text-[11px] text-gray-400">已按品类归档 · 支持搜索与分页浏览</p>
              </div>
            </div>
            <button onClick={() => navigateTo('category')} className="text-xs text-[#FF7A00] font-semibold hover:underline flex items-center gap-0.5">
              查看全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(recommended.length ? recommended : catalogFallback).slice(0, 2).map((p) => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </div>
      </div>

      {/* 模块 2：优先推荐 */}
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500" />
              <h2 className="text-base font-black text-gray-900">优先推荐</h2>
              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded font-medium">已归类商品优先展示</span>
            </div>
            <button onClick={() => navigateTo('category')} className="text-xs text-gray-500 hover:text-[var(--sw-brand)] flex items-center gap-0.5">
              查看全部商品 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {(recommended.length ? recommended : catalogFallback).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>

      {/* 模块 3：已接入品类。只展示当前有货盘的数据，避免用户进入空频道。 */}
      {categories.map((category) => {
        const categoryProducts = products.filter((product) => product.categoryId === category.id).slice(0, 5);
        return (
          <div key={category.id} className="max-w-[1280px] mx-auto px-4">
            <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className={`w-5 h-5 ${category.tone}`} />
                  <h2 className="text-base font-bold text-gray-900">{category.title}</h2>
                  <span className={`text-xs bg-gray-50 px-2 py-0.5 rounded font-medium ${category.tone}`}>{category.tag}</span>
                  <span className="hidden sm:inline text-xs text-gray-400">{category.detail}</span>
                </div>
                <button onClick={() => navigateTo('category', { categoryId: category.id })} className={`text-xs font-semibold hover:underline ${category.tone}`}>
                  查看该品类 <ChevronRight className="inline w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {categoryProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="rounded-md border border-dashed border-blue-200 bg-blue-50/50 p-4 flex gap-3 text-xs text-gray-600">
          <PackageSearch className="w-5 h-5 text-[var(--sw-brand)] flex-shrink-0" />
          <p>
            <strong className="text-gray-900">服务类货盘接入中：</strong>
            电影票、虚拟卡券、附近门店核销将在供应商接口和履约规则确认后单独开放，当前不展示空商品位。
          </p>
        </div>
      </div>
    </>
  );
};
