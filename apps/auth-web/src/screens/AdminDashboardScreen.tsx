/**
 * 智慧翼企业福利商城 - 运营后台管理控制台 (smart.hbbtzn.com)
 * 展示高权限管理界面、审计日志与合规控制
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { useMallContext } from '../context/MallContext';
import { ShieldCheck, LogOut, Users, DollarSign, FileSpreadsheet, KeyRound, ShieldAlert, CheckCircle } from 'lucide-react';

export const AdminDashboardScreen: React.FC = () => {
  const { navigateTo, activeSession, setDomain } = useMallContext();
  const membership = activeSession?.membership;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* 顶部 Header */}
      <header className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700 p-4 sm:p-5 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--sw-brand)] to-[var(--sw-brand-dark)] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">智慧翼运营后台管理系统</h1>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">smart.hbbtzn.com</span>
              </div>
              <p className="text-xs text-slate-400">
                {membership?.enterpriseName || '总部运营中心'} · {membership?.roleName || '超级管理员'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setDomain('hbbtzn.com');
              navigateTo('login');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出管理后台
          </button>
        </div>
      </header>

      {/* 主体区 */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Step-Up 安全认证状态条 */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">TOTP Step-Up 强身份校验已完成</p>
              <p className="text-[11px] text-slate-400">二次验证 Ticket 已成功在服务器端校验并作废，高风险敏感权限（order.refund, role.grant）已激活。</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">授权范围: {membership?.dataScope || '全平台'}</span>
        </div>

        {/* 统计指标 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>在籍企业与员工</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white font-mono">
              12,500 <span className="text-xs font-normal text-slate-400">人</span>
            </p>
          </div>

          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>本月已核销预算</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white font-mono">¥ 3,450,800.00</p>
          </div>

          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>安全审计事件记录</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-white font-mono">
              1,280 <span className="text-xs font-normal text-slate-400">条</span>
            </p>
          </div>
        </div>

        {/* 关键权限区 */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">管理操作面板</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button className="p-4 rounded-xl bg-slate-900 hover:bg-slate-950 border border-slate-700 text-left transition-colors space-y-1">
              <div className="font-semibold text-xs text-blue-300 font-mono">order.refund</div>
              <div className="text-xs text-slate-200 font-bold">高额退款与争议款审核</div>
              <p className="text-[11px] text-slate-400">进行异常订单的退款与人工裁决</p>
            </button>

            <button className="p-4 rounded-xl bg-slate-900 hover:bg-slate-950 border border-slate-700 text-left transition-colors space-y-1">
              <div className="font-semibold text-xs text-emerald-300 font-mono">role.grant</div>
              <div className="text-xs text-slate-200 font-bold">企业管理员角色与权限变更</div>
              <p className="text-[11px] text-slate-400">授予或回收下级管理员的操作权限</p>
            </button>

            <button className="p-4 rounded-xl bg-slate-900 hover:bg-slate-950 border border-slate-700 text-left transition-colors space-y-1">
              <div className="font-semibold text-xs text-purple-300 font-mono">audit.read</div>
              <div className="text-xs text-slate-200 font-bold">统一登录鉴权审计日志</div>
              <p className="text-[11px] text-slate-400">检索全域登录、锁定与 Step-Up 记录</p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
