/**
 * 智慧翼企业福利商城 - 个人中心 UserCenterPage screen
 * 展示员工企业身份、福利与餐卡双账户、订单状态面板及快捷功能入口
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { useMall } from '../context/MallContext';
import { CreditCard, Package, Heart, Ticket, ChevronRight, Building2, Clock, Truck, ShieldAlert, LogOut } from 'lucide-react';
import { AccountSecurityCenter } from '../components/security/AccountSecurityCenter';

export const UserCenterPage: React.FC = () => {
  const { user, navigateTo, orders, sessionStatus, logout, refreshProductionData } = useMall();

  const pendingShipment = orders.filter((o) => o.status === 'pending_shipment').length;
  const pendingReceipt = orders.filter((o) => o.status === 'pending_receipt').length;
  const completed = orders.filter((o) => o.status === 'completed').length;
  const afterSale = orders.filter((o) => o.status === 'after_sale').length;

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-6 font-sans">
      {/* 1. 员工个人名片 Header */}
      <div className="bg-gradient-to-r from-[var(--sw-brand-dark)] via-[var(--sw-brand)] to-blue-800 text-white rounded-md p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full object-cover border-2 border-white/40 shadow-sm" />
          ) : (
            <div aria-label={`${user.name}的默认头像`} className="w-16 h-16 rounded-full bg-white/20 text-white flex items-center justify-center text-2xl font-black border-2 border-white/40 shadow-sm">
              {user.name.slice(0, 1)}
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black">{user.name}</h1>
              <span className="bg-white/20 text-yellow-300 text-xs px-2 py-0.5 rounded font-bold border border-white/20">{user.jobTitle}</span>
              {sessionStatus === 'authenticated' && (
                <span className={`${user.phoneVerified ? 'bg-emerald-500/30 text-emerald-100' : 'bg-amber-400/30 text-amber-100'} rounded border border-white/20 px-2 py-0.5 text-[10px] font-bold`}>
                  {user.phoneVerified ? '手机已验证' : '手机待验证'}
                </span>
              )}
            </div>
            <p className="text-xs text-blue-100 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> {user.enterpriseName} · 部门：{user.department}
            </p>
            <p className="text-[11px] text-blue-200">
              员工工号：<span className="font-mono">{user.employeeId}</span>
            </p>
          </div>
        </div>

        {/* 双账户快捷面板与显式退出入口 */}
        <div className="flex flex-col items-end gap-3 text-xs">
          {sessionStatus === 'authenticated' && (
            <button onClick={() => void logout()} className="flex items-center gap-1.5 rounded border border-white/30 bg-white/10 px-3 py-1.5 font-bold text-white transition-colors hover:bg-white/20">
              <LogOut className="h-3.5 w-3.5" /> 退出登录
            </button>
          )}
          <div className="flex items-center gap-4">
            <div onClick={() => navigateTo('balance', { accountTab: 'welfare' })} className="bg-white/10 hover:bg-white/20 p-3 rounded-md border border-white/20 cursor-pointer transition-colors text-center min-w-[140px]">
              <div className="text-blue-100 font-medium">福利卡账户余额</div>
              <div className="text-xl font-black mt-1 font-mono text-white">¥{user.welfareBalance.toFixed(2)}</div>
              <div className="text-[10px] text-yellow-300 mt-1">点击查看流水 &gt;</div>
            </div>

            <div onClick={() => navigateTo('balance', { accountTab: 'meal' })} className="bg-white/10 hover:bg-white/20 p-3 rounded-md border border-white/20 cursor-pointer transition-colors text-center min-w-[140px]">
              <div className="text-orange-200 font-medium">餐卡专享余额</div>
              <div className="text-xl font-black mt-1 font-mono text-orange-300">¥{user.mealBalance.toFixed(2)}</div>
              <div className="text-[10px] text-orange-200 mt-1">点击查看流水 &gt;</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 我的订单状态总览面板 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 text-xs">
          <span className="font-bold text-sm text-gray-900">我的福利采购订单</span>
          <button onClick={() => navigateTo('orders')} className="text-[var(--sw-brand)] font-bold hover:underline flex items-center gap-0.5">
            查看全部订单 <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          <button onClick={() => navigateTo('orders', { statusFilter: 'pending_payment' })} className="p-3 hover:bg-gray-50 rounded transition-colors cursor-pointer space-y-1">
            <Clock className="w-6 h-6 text-gray-400 mx-auto" />
            <div className="font-bold text-gray-800">待付款</div>
            <div className="text-[11px] text-gray-400">0 单</div>
          </button>

          <button onClick={() => navigateTo('orders', { statusFilter: 'pending_shipment' })} className="p-3 hover:bg-gray-50 rounded transition-colors cursor-pointer space-y-1">
            <Package className="w-6 h-6 text-[var(--sw-brand)] mx-auto" />
            <div className="font-bold text-blue-600">待发货/排单</div>
            <div className="text-[11px] text-gray-500 font-bold">{pendingShipment} 单</div>
          </button>

          <button onClick={() => navigateTo('orders', { statusFilter: 'pending_receipt' })} className="p-3 hover:bg-gray-50 rounded transition-colors cursor-pointer space-y-1">
            <Truck className="w-6 h-6 text-green-600 mx-auto" />
            <div className="font-bold text-green-700">待收货</div>
            <div className="text-[11px] text-gray-500 font-bold">{pendingReceipt} 单</div>
          </button>

          <button onClick={() => navigateTo('orders', { statusFilter: 'completed' })} className="p-3 hover:bg-gray-50 rounded transition-colors cursor-pointer space-y-1">
            <Package className="w-6 h-6 text-gray-600 mx-auto" />
            <div className="font-bold text-gray-800">已完成</div>
            <div className="text-[11px] text-gray-400">{completed} 单</div>
          </button>

          <button onClick={() => navigateTo('orders', { statusFilter: 'after_sale' })} className="p-3 hover:bg-gray-50 rounded transition-colors cursor-pointer space-y-1">
            <ShieldAlert className="w-6 h-6 text-orange-500 mx-auto" />
            <div className="font-bold text-orange-600">售后/退款</div>
            <div className="text-[11px] text-orange-600 font-bold">{afterSale} 单</div>
          </button>
        </div>
      </div>

      {/* 3. 功能管理卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div onClick={() => navigateTo('coupons')} className="bg-white border border-gray-200 rounded-md p-4 shadow-xs hover:border-orange-300 cursor-pointer transition-all flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-orange-50 text-[#FF7A00] flex items-center justify-center font-bold">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">我的电子卡券包</div>
              <div className="text-gray-400 text-[11px] mt-0.5">
                持有 <strong className="text-orange-600">{user.couponCount}</strong> 张可用卡券/电影门票
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>

        <div onClick={() => navigateTo('balance')} className="bg-white border border-gray-200 rounded-md p-4 shadow-xs hover:border-blue-300 cursor-pointer transition-all flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-blue-50 text-[var(--sw-brand)] flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">账户与交易日志</div>
              <div className="text-gray-400 text-[11px] mt-0.5">福利卡/餐卡变动溯源明细</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>

        <div onClick={() => navigateTo('category')} className="bg-white border border-gray-200 rounded-md p-4 shadow-xs hover:border-pink-300 cursor-pointer transition-all flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-pink-50 text-pink-600 flex items-center justify-center font-bold">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">商品收藏夹</div>
              <div className="text-gray-400 text-[11px] mt-0.5">关注心仪的特惠商品</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
      {sessionStatus === 'authenticated' && <AccountSecurityCenter onSignedOut={() => void logout()} onSecurityChanged={refreshProductionData} />}
    </div>
  );
};
