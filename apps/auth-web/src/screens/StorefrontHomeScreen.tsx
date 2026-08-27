/**
 * 智慧翼企业福利商城 - 员工端首页 (hbbtzn.com)
 * 展示员工福利余额、餐卡及专区商品入口
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { useMallContext } from '../context/MallContext';
import { Store, CreditCard, User, LogOut, Sparkles, Gift, Utensils, ShoppingBag } from 'lucide-react';

export const StorefrontHomeScreen: React.FC = () => {
  const { navigateTo, activeSession, setDomain } = useMallContext();
  const membership = activeSession?.membership;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 顶部渐变 Header */}
      <header className="bg-gradient-to-r from-[var(--sw-brand-dark)] to-[var(--sw-brand)] text-white p-4 sm:p-6 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">智慧翼企业福利商城（员工端）</h1>
              <p className="text-xs text-blue-100 font-mono">hbbtzn.com</p>
            </div>
          </div>

          <button
            onClick={() => {
              setDomain('hbbtzn.com');
              navigateTo('login');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium backdrop-blur-md transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出登录
          </button>
        </div>
      </header>

      {/* 主体卡片区 */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* 当前身份及专区信息 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-[var(--sw-brand)] rounded-md border border-blue-100">
              <User className="w-3 h-3" />
              {membership?.accountTypeLabel || '福利账户'}
            </span>
            <h2 className="text-xl font-bold text-slate-900">{membership?.storeName || '员工福利专区'}</h2>
            <p className="text-xs text-slate-500">
              企业：{membership?.enterpriseName || '示例企业'} · 身份：{membership?.roleName || '正式员工'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-400">本期可用福利额度</p>
              <p className="text-2xl font-extrabold text-[var(--sw-brand)] font-mono">¥ 2,800.00</p>
            </div>
          </div>
        </div>

        {/* 快捷功能卡片 grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[var(--sw-brand)] flex items-center justify-center">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">生日/节日套餐</h3>
              <p className="text-xs text-slate-500 mt-1">选购企业精选节日礼包与定制蛋糕卡</p>
            </div>
            <button className="text-xs font-semibold text-[var(--sw-brand)] hover:underline">去兑换 &rarr;</button>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">园区餐贴点餐</h3>
              <p className="text-xs text-slate-500 mt-1">关联园区餐厅与外卖，每日餐补直接抵扣</p>
            </div>
            <button className="text-xs font-semibold text-emerald-600 hover:underline">查看点餐专区 &rarr;</button>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">员工特惠自营</h3>
              <p className="text-xs text-slate-500 mt-1">特约品牌折扣、数码家电与数位卡券</p>
            </div>
            <button className="text-xs font-semibold text-purple-600 hover:underline">进入商城 &rarr;</button>
          </div>
        </div>
      </main>
    </div>
  );
};
