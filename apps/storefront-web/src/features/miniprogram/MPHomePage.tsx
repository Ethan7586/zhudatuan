import React, { useState } from 'react';
import { useMall } from '../../context/MallContext';
import { WeChatCapsule } from '../../components/mobile/WeChatCapsule';
import { WeChatTabBar } from '../../components/mobile/WeChatTabBar';
import { MPProductFeed } from './MPProductFeed';
import { CreditCard, Utensils, Search, ChevronRight, Flame, Store, Ticket, ShoppingBag, Gift, Tv, Coffee, Sparkles, Plus, ShieldCheck, Building2, Tag } from 'lucide-react';

export const MPHomePage: React.FC = () => {
  const { user, currentMall, setMpPage, addToCart, triggerPendingFeature, presentationProducts: MOCK_PRODUCTS } = useMall();
  const [activeBanner, setActiveBanner] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');

  const banners = [
    {
      id: 1,
      title: '中秋关怀 · 企采礼包专场',
      desc: '全额福利卡扣减 · 免费开票直达',
      color: 'from-[var(--sw-brand-dark)] to-[var(--sw-brand)]',
    },
    {
      id: 2,
      title: '品牌代金券 · 凭码即刻核销',
      desc: '星巴克/猫眼电影/肯德基 协议价8折起',
      color: 'from-[#FF7A00] to-amber-600',
    },
    {
      id: 3,
      title: '米面粮油与生鲜劳保',
      desc: '有机五常大米 · 产地直供免运费',
      color: 'from-emerald-700 to-teal-600',
    },
  ];

  // Quick 8 categories (Meituan B2C info architecture style)
  const quickCategories = [
    { name: '福利卡专区', icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
    { name: '餐卡专区', icon: Utensils, color: 'text-orange-600 bg-orange-50' },
    { name: '影音卡券', icon: Ticket, color: 'text-purple-600 bg-purple-50' },
    { name: '星巴克/咖啡', icon: Coffee, color: 'text-emerald-600 bg-emerald-50' },
    { name: '米面粮油', icon: ShoppingBag, color: 'text-amber-600 bg-amber-50' },
    { name: '附近门店', icon: Store, color: 'text-cyan-600 bg-cyan-50' },
    { name: '数码办公', icon: Tv, color: 'text-indigo-600 bg-indigo-50' },
    { name: '全员礼品', icon: Gift, color: 'text-rose-600 bg-rose-50' },
  ];

  const enterpriseExclusives = MOCK_PRODUCTS.filter((p) => p.isEnterpriseExclusive).slice(0, 4);
  const nearbyServices = MOCK_PRODUCTS.filter((p) => p.itemType === 'nearby_store').slice(0, 2);

  return (
    <div className="bg-[#F5F7FA] min-h-full flex flex-col font-sans text-gray-800">
      {/* 顶部胶囊 Header */}
      <WeChatCapsule />

      {/* 搜索框区 */}
      <div className="bg-[var(--sw-brand-dark)] px-3 pb-3 pt-1">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setMpPage('category')}
            placeholder="搜索福利卡可兑商品、米面粮油、影音卡券..."
            className="w-full bg-white text-gray-900 placeholder-gray-400 text-xs pl-8 pr-16 py-2 rounded-full focus:outline-none shadow-inner font-medium"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <button onClick={() => setMpPage('category')} className="absolute right-1 top-1/2 -translate-y-1/2 bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-bold text-xs px-3 py-1 rounded-full cursor-pointer">
            搜索
          </button>
        </div>
      </div>

      {/* 福利与餐卡余额双 Pill 卡片 */}
      <div className="px-3 -mt-1.5 z-10">
        <div className="bg-white rounded-2xl p-3 shadow-md border border-blue-100 flex items-center justify-between divide-x divide-gray-100">
          <div onClick={() => setMpPage('profile')} className="flex-1 pr-2 flex items-center gap-2 cursor-pointer active:opacity-70 transition-opacity">
            <div className="w-8 h-8 rounded-xl bg-[var(--sw-brand)] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-medium">福利卡余额</div>
              <div className="text-sm font-black text-[var(--sw-brand)] font-mono">¥{user.welfareBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div onClick={() => setMpPage('profile')} className="flex-1 pl-3 flex items-center gap-2 cursor-pointer active:opacity-70 transition-opacity">
            <div className="w-8 h-8 rounded-xl bg-[#FF7A00] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-medium">餐卡专享余额</div>
              <div className="text-sm font-black text-[#FF7A00] font-mono">¥{user.mealBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 活动轮播图 */}
      <div className="px-3 mt-3">
        <div className={`relative rounded-2xl overflow-hidden shadow-sm bg-gradient-to-r ${banners[activeBanner].color} p-4 text-white min-h-[110px] flex flex-col justify-between`}>
          <div>
            <span className="inline-block bg-white/20 text-yellow-300 text-[9px] font-bold px-2 py-0.5 rounded-full mb-1 border border-white/20">微信小程序企业专享</span>
            <h2 className="text-sm font-black leading-tight">{banners[activeBanner].title}</h2>
            <p className="text-[10px] text-blue-100 mt-0.5">{banners[activeBanner].desc}</p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button onClick={() => setMpPage('category')} className="bg-white text-[var(--sw-brand-dark)] font-bold text-[10px] px-3 py-1 rounded-full flex items-center gap-0.5 shadow-xs cursor-pointer">
              <span>立即去兑换</span>
              <ChevronRight className="w-3 h-3" />
            </button>

            <div className="flex items-center gap-1">
              {banners.map((_, i) => (
                <button key={i} onClick={() => setActiveBanner(i)} className={`h-1 rounded-full transition-all cursor-pointer ${activeBanner === i ? 'w-4 bg-yellow-300' : 'w-1 bg-white/40'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 金刚区：8大分类入口 (Meituan mobile architecture) */}
      <div className="px-3 mt-3">
        <div className="bg-white rounded-2xl p-3 shadow-xs grid grid-cols-4 gap-3 text-center border border-gray-100">
          {quickCategories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div key={idx} onClick={() => setMpPage('category')} className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs ${cat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-gray-700 truncate w-full">{cat.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 企业专享补贴栏 */}
      <div className="px-3 mt-3">
        <div className="bg-white rounded-2xl p-3 shadow-xs border border-gray-100">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <span className="bg-[var(--sw-brand-dark)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">企采协议</span>
              <h3 className="text-xs font-black text-gray-900">企业大客户内购补贴</h3>
            </div>
            <button onClick={() => setMpPage('category')} className="text-[10px] text-[var(--sw-brand)] font-bold flex items-center">
              <span>查看全部</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {enterpriseExclusives.map((p) => (
              <div key={p.id} onClick={() => setMpPage('detail', p.id)} className="bg-gray-50/80 rounded-xl p-2 flex gap-2 border border-gray-100 cursor-pointer active:bg-blue-50/50 transition-colors">
                <img src={p.imageUrl} alt={p.title} className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                <div className="overflow-hidden flex flex-col justify-between flex-1">
                  <div className="text-[11px] font-bold text-gray-800 truncate">{p.title}</div>
                  <div>
                    <span className="text-[9px] text-[var(--sw-brand)] bg-blue-50 font-bold px-1 py-0.2 rounded">省¥{p.enterpriseSubsidyAmount}</span>
                    <div className="text-xs font-black text-[#E5484D] font-mono mt-0.5">¥{p.price}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 美团风格：附近门店凭码核销 */}
      <div className="px-3 mt-3">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-2xl p-3 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Store className="w-4 h-4 text-[var(--sw-brand)]" />
              <h3 className="text-xs font-black text-gray-900">附近门店凭码即刻核销</h3>
              <span className="text-[9px] bg-blue-100 text-[var(--sw-brand)] font-bold px-1.5 py-0.2 rounded-full">免运费 · 到店出示二维码</span>
            </div>
            <button onClick={() => triggerPendingFeature('微信小程序 LBS 位置定位', '定位附近的加盟美发、烘焙甜品、健身房核销门店。')} className="text-[10px] text-gray-500 hover:text-blue-600 flex items-center">
              定位: 北京朝阳 &gt;
            </button>
          </div>

          <div className="space-y-2">
            {nearbyServices.map((p) => (
              <div key={p.id} onClick={() => setMpPage('detail', p.id)} className="bg-white rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs border border-gray-100 cursor-pointer">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <img src={p.imageUrl} alt={p.title} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-gray-900 truncate">{p.title}</div>
                    <div className="text-[10px] text-gray-500 truncate mt-0.5">{p.applicableStoreName || '包含朝阳区国贸店、三里屯店等28家门店'}</div>
                    <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3 h-3" />
                      <span>企采卡券包全额抵扣</span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-black text-[#E5484D]">¥{p.price}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(p, 1);
                    }}
                    className="mt-1 bg-[var(--sw-brand)] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs cursor-pointer"
                  >
                    兑换卡券
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <MPProductFeed />

      {/* 固定 Bottom TabBar */}
      <WeChatTabBar />
    </div>
  );
};
