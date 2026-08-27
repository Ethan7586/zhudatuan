/**
 * 智慧翼企业福利商城 - 顶栏与主导航 HeaderBar 组件
 * 包含企业商城切换、大型搜索与实时联想、福利卡/餐卡余额卡片、购物车与快捷分类
 * 技术服务方：雍彻科技
 */
import React, { useState, useRef, useEffect } from 'react';
import { HeaderEnterpriseBar } from './HeaderEnterpriseBar';
import { useMall, PageRoute } from '../../context/MallContext';
import { Search, ShoppingCart, CreditCard, Utensils, Building2, ChevronDown, Headphones, User, Heart, Wallet, Sparkles, ShieldCheck, Menu, ChevronRight, Flame } from 'lucide-react';
export const HeaderBar: React.FC = () => {
  const { user, currentMall, malls, switchMall, cartCount, navigateTo, currentPage, products, sessionStatus } = useMall();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showSearchSuggest, setShowSearchSuggest] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  // Search suggestion matches
  const suggestions = searchKeyword.trim()
    ? products.filter((p) => p.title.toLowerCase().includes(searchKeyword.toLowerCase()) || p.categoryName.includes(searchKeyword) || p.brand.toLowerCase().includes(searchKeyword.toLowerCase())).slice(0, 6)
    : [];
  const catalogNavigation = [
    { id: 'cat_welfare_zone', label: '企业福利专区', icon: true },
    { id: 'cat_food', label: '食品饮料' },
    { id: 'cat_appliance', label: '家用电器' },
    { id: 'cat_digital', label: '数码办公' },
    { id: 'cat_home', label: '家居日用' },
    { id: 'cat_personal', label: '个护清洁' },
    { id: 'cat_apparel', label: '服饰鞋包' },
    { id: 'cat_supermarket', label: '商超商品' },
  ].filter((item) => products.some((product) => product.categoryId === item.id));
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchSuggest(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const handleSearchSubmit = (kw?: string) => {
    const finalKw = kw !== undefined ? kw : searchKeyword;
    setShowSearchSuggest(false);
    navigateTo('category', { keyword: finalKw });
  };
  const hotKeywords = ['五常大米', '星巴克卡', '戴森吸尘器', '电影通兑', '盒马鲜生', '端午礼盒', '途虎洗车'];
  return (
    <header className="w-full bg-white border-b border-gray-200 select-none sticky top-0 z-40 shadow-xs">
      <HeaderEnterpriseBar />
      <div className="max-w-[1280px] mx-auto py-3 px-3 md:py-3.5 md:px-4 flex items-center justify-between gap-3 md:gap-6">
        <div onClick={() => navigateTo('home')} className="group flex shrink-0 cursor-pointer items-center gap-3">
          <img src="/icon.svg" alt="" className="h-10 w-10 rounded-xl shadow-md shadow-blue-500/10 transition-transform group-hover:scale-105" />
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-gray-900 font-sans">智慧翼</span>
              <span className="text-xs bg-[var(--sw-brand-light)] text-[var(--sw-brand)] font-bold px-1.5 py-0.5 rounded border border-blue-200">福利商城</span>
            </div>
            <div className="text-[11px] text-gray-400 font-normal tracking-wide flex items-center gap-1">
              <span>{currentMall.logoText}</span>
              <span>·</span>
              <span className="text-blue-600 font-medium">B2B2C 企采通</span>
            </div>
          </div>
        </div>
        <div className="relative min-w-0 max-w-2xl flex-1" ref={searchContainerRef}>
          <div className="flex items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setShowSearchSuggest(true);
                }}
                onFocus={() => setShowSearchSuggest(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="搜索福利卡可兑商品、米面粮油、影音卡券、附近门店..."
                className="w-full min-w-0 pl-10 pr-4 py-2.5 text-sm bg-gray-50 border-2 border-[var(--sw-brand)] rounded-l-md focus:outline-none focus:bg-white text-gray-900 placeholder-gray-400"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <button onClick={() => handleSearchSubmit()} className="bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-medium text-sm px-3 sm:px-6 py-2.5 rounded-r-md transition-colors flex shrink-0 items-center gap-1.5 cursor-pointer">
              <span>搜索</span>
            </button>
          </div>
          {showSearchSuggest && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-2xl border border-gray-200 z-50 overflow-hidden divide-y divide-gray-100">
              <div className="p-2 text-xs font-semibold text-gray-400 bg-gray-50 flex items-center justify-between">
                <span>匹配商城推荐商品</span>
                <span className="text-blue-600">回车快速搜索</span>
              </div>
              {suggestions.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    navigateTo('detail', { productId: p.id });
                    setShowSearchSuggest(false);
                  }}
                  className="p-2.5 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <img src={p.images[0]} alt={p.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    <span className="font-medium text-gray-800 truncate">{p.title}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[#FF7A00] font-bold">¥{p.priceWelfare.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-400 block">{p.supplierName}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="hidden md:flex items-center gap-2 mt-1.5 text-xs text-gray-500 overflow-x-auto whitespace-nowrap">
            <span className="text-gray-400 text-[11px] font-medium flex items-center gap-0.5">
              <Flame className="w-3 h-3 text-orange-500" />
              热搜：
            </span>
            {hotKeywords.map((kw) => (
              <button key={kw} onClick={() => handleSearchSubmit(kw)} className="hover:text-[var(--sw-brand)] transition-colors text-[11px] text-gray-600 cursor-pointer">
                {kw}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigateTo('balance', { accountTab: 'welfare' })}
            className="hidden lg:flex bg-[var(--sw-brand-light)] hover:bg-blue-100 border border-blue-200 rounded-md p-2 items-center gap-2.5 cursor-pointer transition-colors"
          >
            <div className="w-8 h-8 rounded bg-[var(--sw-brand)] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-blue-700 font-medium leading-none">福利卡余额</div>
              <div className="text-sm font-black text-[var(--sw-brand)] mt-0.5">¥{user.welfareBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div onClick={() => navigateTo('balance', { accountTab: 'meal' })} className="hidden lg:flex bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md p-2 items-center gap-2.5 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded bg-[#FF7A00] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-orange-700 font-medium leading-none">餐卡余额</div>
              <div className="text-sm font-black text-[#FF7A00] mt-0.5">¥{user.mealBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <button
            onClick={() => navigateTo('cart')}
            aria-label={`购物车，${cartCount} 件商品`}
            className="relative flex min-h-[var(--sw-min-touch-target)] min-w-[var(--sw-min-touch-target)] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-gray-900 px-3 py-2.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-black sm:px-4"
          >
            <ShoppingCart className="w-4 h-4 text-blue-300" />
            <span className="hidden sm:inline">购物车</span>
            {cartCount > 0 && <span className="min-w-5 rounded-full bg-[#FF7A00] px-1 text-xs font-bold leading-5 text-white">{cartCount > 99 ? '99+' : cartCount}</span>}
          </button>
        </div>
      </div>
      <div className="hidden md:block bg-[var(--sw-brand)] text-white shadow-xs">
        <div className="max-w-[1280px] mx-auto px-4 flex items-center justify-between text-xs font-semibold">
          <div onClick={() => navigateTo('category')} className="w-56 bg-[var(--sw-brand-dark)] py-2.5 px-4 flex items-center justify-between cursor-pointer hover:bg-blue-900 transition-colors">
            <div className="flex items-center gap-2">
              <Menu className="w-4 h-4 text-yellow-300" />
              <span className="tracking-wide text-sm">全部商品分类</span>
            </div>
            <ChevronRight className="w-4 h-4 text-blue-300" />
          </div>
          <div className="flex-1 flex items-center gap-1 ml-4 py-1.5 overflow-x-auto">
            <button onClick={() => navigateTo('home')} className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${currentPage === 'home' ? 'bg-white/20 text-white font-bold' : 'hover:bg-white/10 text-blue-50'}`}>
              首页
            </button>
            {catalogNavigation.map((item) => (
              <button key={item.id} onClick={() => navigateTo('category', { categoryId: item.id })} className="px-3 py-1.5 rounded hover:bg-white/10 text-blue-50 transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap">
                {item.icon && <Sparkles className="w-3.5 h-3.5 text-yellow-300" />}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-blue-100 font-normal text-xs bg-white/10 px-3 py-1 rounded border border-white/20">
            <ShieldCheck className="w-3.5 h-3.5 text-yellow-300" />
            <span>国企/央企特规正品保障</span>
          </div>
        </div>
      </div>
    </header>
  );
};
