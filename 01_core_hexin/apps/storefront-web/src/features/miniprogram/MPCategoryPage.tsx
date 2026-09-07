import React, { useState } from 'react';
import { Plus, Search, ShoppingBag } from 'lucide-react';
import { WeChatCapsule } from '../../components/mobile/WeChatCapsule';
import { useMall } from '../../context/MallContext';
import { storefrontImageUrl } from '../../services/storefrontImageUrl';

export const MPCategoryPage: React.FC = () => {
  const { setMpPage, addToCart, presentationProducts: products, presentationCategories: categories } = useMall();
  const [activeCategoryId, setActiveCategoryId] = useState(() => categories[0]?.id ?? 'cat_all');
  const [keyword, setKeyword] = useState('');

  const currentCategory = categories.find((category) => category.id === activeCategoryId) || categories[0];

  if (!currentCategory) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#F4F6FA] font-sans text-gray-900">
        <WeChatCapsule title="商品分类" />
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[var(--sw-brand)] shadow-[0_10px_30px_rgba(30,64,175,0.10)]">
            <ShoppingBag className="h-7 w-7" strokeWidth={1.8} />
          </div>
          <h1 className="mt-4 text-sm font-black text-gray-900">商品分类正在同步</h1>
          <p className="mt-1 text-xs leading-5 text-gray-400">网络恢复后会自动加载，无需刷新整个页面。</p>
        </div>
      </div>
    );
  }

  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategoryId === 'cat_all' || product.categoryId === activeCategoryId;
    const matchesKeyword = !keyword || product.title.includes(keyword) || product.subtitle?.includes(keyword);
    return matchesCategory && matchesKeyword;
  });
  const showCategoryRail = categories.length > 1;
  const stockedCategoryId = categories.find((category) => products.some((product) => product.categoryId === category.id))?.id;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F4F6FA] font-sans text-gray-900">
      <WeChatCapsule title="商品分类" />

      <div className="shrink-0 px-3 pb-2.5 pt-3">
        <label className="flex h-11 items-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
          <Search className="h-4 w-4 flex-none text-gray-400" />
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索福利商品"
            aria-label="搜索福利商品"
            className="min-w-0 flex-1 bg-transparent text-xs font-medium text-gray-900 outline-none placeholder:text-gray-400"
          />
          {keyword && (
            <button type="button" onClick={() => setKeyword('')} aria-label="清除搜索" className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 active:bg-gray-200">
              ✕
            </button>
          )}
        </label>
      </div>

      <div className={`flex min-h-0 flex-1 px-3 pb-3 ${showCategoryRail ? 'gap-2.5' : ''}`}>
        {showCategoryRail && (
          <nav aria-label="商品分类" className="w-[82px] flex-none overflow-y-auto overscroll-contain rounded-2xl bg-[#E9EDF5] p-1.5 no-scrollbar">
            <div className="space-y-1">
              {categories.map((category) => {
                const isActive = category.id === activeCategoryId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      setActiveCategoryId(category.id);
                      setKeyword('');
                    }}
                    className={`relative flex min-h-12 w-full items-center justify-center rounded-xl px-2 text-center text-[11px] leading-4 ${
                      isActive
                        ? 'bg-white font-black text-[var(--sw-brand)] shadow-[0_3px_10px_rgba(15,23,42,0.07)]'
                        : 'font-medium text-gray-600 active:bg-white/60'
                    }`}
                  >
                    {isActive && <span className="absolute left-1.5 h-4 w-0.5 rounded-full bg-[var(--sw-brand)]" />}
                    <span className="line-clamp-2">{category.name}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
          <section className="rounded-2xl bg-gradient-to-r from-[#123D91] to-[#2166E8] p-3.5 text-white shadow-[0_8px_22px_rgba(29,78,216,0.15)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[9px] font-medium text-blue-100">当前分类</div>
                <h1 className="mt-0.5 truncate text-sm font-black tracking-tight">{currentCategory.name}</h1>
                <p className="mt-1 text-[10px] text-blue-100">共 {filteredProducts.length} 件商品</p>
              </div>
              <span className="flex-none rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-bold ring-1 ring-inset ring-white/15">福利卡可用</span>
            </div>
          </section>

          {currentCategory.subCategories && currentCategory.subCategories.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl bg-white p-2 shadow-[0_3px_14px_rgba(15,23,42,0.04)]">
              {currentCategory.subCategories.slice(0, 6).map((subcategory) => (
                <button
                  key={subcategory.id}
                  type="button"
                  onClick={() => setKeyword(subcategory.name)}
                  className="min-h-8 truncate rounded-lg bg-gray-50 px-1.5 text-[9px] font-medium text-gray-600 active:bg-blue-50 active:text-[var(--sw-brand)]"
                >
                  {subcategory.name}
                </button>
              ))}
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="mt-2.5 rounded-2xl border border-gray-100 bg-white px-4 py-10 text-center shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-bold text-gray-700">{keyword ? '没有找到相关商品' : `${currentCategory.name}正在上新`}</p>
              <p className="mt-1 text-[10px] leading-4 text-gray-400">{keyword ? '换个关键词，或者查看这个分类的全部商品' : '分类入口已经保留，商品上架后会显示在这里'}</p>
              {keyword ? (
                <button type="button" onClick={() => setKeyword('')} className="mt-2 min-h-8 px-3 text-[10px] font-bold text-[var(--sw-brand)]">
                  清除搜索条件
                </button>
              ) : stockedCategoryId && stockedCategoryId !== activeCategoryId ? (
                <button type="button" onClick={() => setActiveCategoryId(stockedCategoryId)} className="mt-2 min-h-8 px-3 text-[10px] font-bold text-[var(--sw-brand)]">
                  先看已上架商品
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-2.5 space-y-2.5 pb-3">
              {filteredProducts.map((product) => (
                <article
                  key={product.id}
                  onClick={() => setMpPage('detail', product.id)}
                  className="flex gap-2.5 rounded-2xl border border-gray-100 bg-white p-2.5 shadow-[0_5px_18px_rgba(15,23,42,0.05)] active:bg-gray-50"
                >
                  <img
                    src={storefrontImageUrl(product.imageUrl, 152)}
                    srcSet={`${storefrontImageUrl(product.imageUrl, 152)} 2x, ${storefrontImageUrl(product.imageUrl, 228)} 3x`}
                    alt={product.title}
                    width={76}
                    height={76}
                    loading="lazy"
                    decoding="async"
                    className="h-[76px] w-[76px] flex-none rounded-xl border border-gray-100 bg-gray-50 object-cover"
                  />

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <h2 className="line-clamp-2 text-[11px] font-bold leading-[16px] text-gray-900">{product.title}</h2>
                      <div className="mt-1.5 flex min-w-0 gap-1">
                        {product.enterpriseSubsidyAmount > 0 && (
                          <span className="truncate rounded-md bg-red-50 px-1.5 py-0.5 text-[8px] font-bold text-[#E5484D]">协议省¥{product.enterpriseSubsidyAmount}</span>
                        )}
                        <span className="flex-none rounded-md bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-blue-700">福利卡可用</span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-1.5">
                      <div className="min-w-0 whitespace-nowrap">
                        <span className="font-mono text-sm font-black text-[#E5484D]"><span className="text-[9px]">¥</span>{product.price}</span>
                        {product.originalPrice > product.price && <span className="ml-1 font-mono text-[8px] text-gray-400 line-through">¥{product.originalPrice}</span>}
                      </div>
                      <button
                        type="button"
                        aria-label={`加入购物车：${product.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          addToCart(product, 1);
                        }}
                        className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--sw-brand)] text-white shadow-[0_4px_10px_rgba(37,99,235,0.22)] active:bg-[var(--sw-brand-dark)]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
