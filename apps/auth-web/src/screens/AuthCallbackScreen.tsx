/**
 * 智慧翼企业福利商城 - 运营后台跨域票据回调 (smart.hbbtzn.com/auth/callback)
 * 模拟一次性票据 (Ticket) 兑换、无存储落地校验与会话签发
 * 技术服务方：雍彻科技
 */

import React, { useEffect, useState } from 'react';
import { useMallContext } from '../context/MallContext';
import { exchangeTicket } from '../services/auth';
import { ShieldCheck, CheckCircle2, ArrowLeft, RefreshCw, Key, Shield, ExternalLink } from 'lucide-react';

export const AuthCallbackScreen: React.FC = () => {
  const { screenParams, navigateTo, setDomain, setActiveSession } = useMallContext();
  const ticket = screenParams.ticket || '';
  const membership = screenParams.membership;

  const [exchanging, setExchanging] = useState<boolean>(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // 切换当前域标识为 smart.hbbtzn.com
    setDomain('smart.hbbtzn.com');

    async function doExchange() {
      try {
        if (!ticket) {
          throw new Error('未检测到有效的跨域授权票据 Ticket');
        }
        const res = await exchangeTicket(ticket);
        setSessionData(res.sessionInfo);
        setActiveSession({
          membership,
          domain: 'smart.hbbtzn.com',
          ticket,
        });
      } catch (err: any) {
        setError(err.message || '票据兑换失败');
      } finally {
        setExchanging(false);
      }
    }

    doExchange();
  }, [ticket]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-2xl space-y-6 relative overflow-hidden">
        {/* 顶栏渐变装饰 */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--sw-brand)] via-[var(--sw-brand-dark)] to-emerald-500" />

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">运营后台跨域票据回调处理</h2>
            <p className="text-xs font-mono text-blue-400">smart.hbbtzn.com/auth/callback</p>
          </div>
        </div>

        {/* 票据合规隔离声明 */}
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-700 text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-emerald-400">
            <Shield className="w-3.5 h-3.5" />
            安全合规红线核查：
          </div>
          <p className="text-[11px] text-slate-400">
            • 票据 (Ticket) 为一次性使用，兑换后立即作废；
            <br />• 绝无写入 <code className="text-blue-300">localStorage</code> 或 <code className="text-blue-300">sessionStorage</code>；<br />• 会话由运营后台服务端签发 HttpOnly 独立 Cookie。
          </p>
        </div>

        {exchanging && (
          <div className="py-8 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[var(--sw-brand)] animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-200">正在与运营后台服务端校验 Ticket 并换取管理 Session...</p>
            <p className="text-xs font-mono text-slate-500 break-all px-4">Ticket: {ticket}</p>
          </div>
        )}

        {!exchanging && error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs space-y-3">
            <p className="font-bold text-sm">票据核验失败</p>
            <p>{error}</p>
            <button
              onClick={() => {
                setDomain('hbbtzn.com');
                navigateTo('login');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回统一登录页
            </button>
          </div>
        )}

        {!exchanging && sessionData && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                Step-Up 验签通过，票据兑换成功
              </div>
              <div className="text-xs text-slate-300 space-y-1 pt-1 font-mono">
                <p>角色: {membership?.roleName || sessionData.role}</p>
                <p>企业: {membership?.enterpriseName || '智慧翼运营'}</p>
                <p>签发时间: {sessionData.issuedAt}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigateTo('admin_dashboard', { membership })}
                className="flex-1 py-3 px-4 bg-[var(--sw-brand)] hover:bg-[var(--sw-brand-dark)] text-white font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                进入运营后台控制面板 (smart.hbbtzn.com)
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setDomain('hbbtzn.com');
                  navigateTo('login');
                }}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-xs rounded-xl transition-all"
              >
                重新登录
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
