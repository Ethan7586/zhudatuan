import React, { useState } from 'react';
import { Building2, ChevronDown, Headphones, LogOut, User } from 'lucide-react';
import { useMall } from '../../context/MallContext';

export const HeaderEnterpriseBar: React.FC = () => {
  const { user, currentMall, malls, switchMall, navigateTo, sessionStatus, logout } = useMall();
  const [showMallDropdown, setShowMallDropdown] = useState(false);
  return (
    <>
      {/* 1. 顶部公共服务栏 */}
      <div className="hidden md:block bg-[var(--sw-brand-dark)] text-white text-xs py-1.5 px-4">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          {/* 左侧：当前所属企业与商城切换 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-medium text-blue-100">
              <Building2 className="w-3.5 h-3.5 text-blue-300" />
              <span>当前所属单位：{user.enterpriseName}</span>
            </div>

            <div className="h-3 w-[1px] bg-blue-400/40" />

            {/* 商城切换 Dropdown */}
            <div className="relative">
              <button onClick={() => setShowMallDropdown(!showMallDropdown)} className="flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-2 py-0.5 rounded text-xs transition-colors cursor-pointer">
                <span className="font-semibold">{currentMall.logoText}</span>
                <span className="text-blue-200">({currentMall.mallName})</span>
                <ChevronDown className="w-3 h-3 text-blue-200" />
              </button>

              {showMallDropdown && (
                <div className="absolute left-0 top-full mt-1.5 w-72 bg-white text-gray-800 rounded shadow-xl border border-gray-200 z-50 py-2">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">可切换的专属企业福利商城</div>
                  {malls.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        switchMall(m.id);
                        setShowMallDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between transition-colors ${m.id === currentMall.id ? 'bg-blue-50/80 text-[var(--sw-brand)] font-semibold' : 'text-gray-700'}`}
                    >
                      <div>
                        <div className="font-medium">{m.mallName}</div>
                        <div className="text-[11px] text-gray-400">{m.enterpriseName}</div>
                      </div>
                      {m.id === currentMall.id && <span className="text-[10px] bg-[var(--sw-brand)] text-white px-1.5 py-0.5 rounded">当前</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：用户状态与快捷导航 */}
          <div className="flex items-center gap-4 text-blue-100 text-xs">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-300" />
              <span>
                {user.name} ({user.department})
              </span>
            </div>

            <div className="h-3 w-[1px] bg-blue-400/40" />

            <button onClick={() => navigateTo('orders')} className="hover:text-white transition-colors cursor-pointer flex items-center gap-1">
              我的订单
            </button>

            <button onClick={() => navigateTo('coupons')} className="hover:text-white transition-colors cursor-pointer flex items-center gap-1">
              我的卡券
              <span className="bg-orange-500 text-white text-[10px] px-1 rounded-full font-bold">{user.couponCount}</span>
            </button>

            <button onClick={() => navigateTo('balance')} className="hover:text-white transition-colors cursor-pointer flex items-center gap-1">
              账户流水
            </button>

            <button onClick={() => navigateTo('user-center')} className="hover:text-white transition-colors cursor-pointer flex items-center gap-1">
              个人中心
            </button>

            {sessionStatus === 'authenticated' && (
              <>
                <button onClick={() => void logout()} className="rounded border border-white/25 px-2 py-0.5 text-white hover:bg-white/15 transition-colors cursor-pointer flex items-center gap-1 font-bold">
                  <LogOut className="w-3.5 h-3.5" /> 退出
                </button>
              </>
            )}

            <div className="h-3 w-[1px] bg-blue-400/40" />

            <div className="flex items-center gap-1 text-blue-200 hover:text-white cursor-pointer">
              <Headphones className="w-3.5 h-3.5" />
              <span>专属客服</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
