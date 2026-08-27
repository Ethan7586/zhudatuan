/**
 * 智慧翼企业福利商城 - 福利余额与账户流水 BalancePage screen
 * 展示福利卡与餐卡余额汇总、集团定期额度补贴发放日志及实时消费对账流水
 * 技术服务方：雍彻科技
 */

import React, { useState } from 'react';
import { useMall } from '../context/MallContext';
import { CreditCard, Utensils, ArrowUpRight, ArrowDownLeft, Calendar, Building2, FileText, ChevronRight, ShieldCheck, Download } from 'lucide-react';

export const BalancePage: React.FC = () => {
  const { user, routeParams, showToast, accountLogs } = useMall();

  const [activeAccountTab, setActiveAccountTab] = useState<'welfare' | 'meal'>((routeParams.accountTab as any) || 'welfare');

  const filteredLogs = accountLogs.filter((l) => l.accountType === activeAccountTab);

  const downloadStatement = () => {
    const rows = filteredLogs.map((log) => [log.time, log.title, log.orderNo ?? '', log.amount.toFixed(2), log.balanceAfter.toFixed(2)]);
    const csv = [['交易时间', '业务描述', '关联单号', '变动金额', '变动后余额'], ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `智慧翼-${activeAccountTab === 'welfare' ? '福利卡' : '餐卡'}账户流水.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('真实账户流水已导出为 CSV 对账文件', 'success');
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-6 font-sans text-xs">
      {/* 1. 账户概览与双卡卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 福利卡卡片 */}
        <div
          onClick={() => setActiveAccountTab('welfare')}
          className={`p-6 rounded-md cursor-pointer transition-all border shadow-xs ${
            activeAccountTab === 'welfare' ? 'bg-gradient-to-r from-[var(--sw-brand-dark)] to-[var(--sw-brand)] text-white border-blue-500 ring-2 ring-blue-400/30' : 'bg-white text-gray-800 border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-90 mb-2">
            <span className="font-bold flex items-center gap-1.5">
              <CreditCard className="w-4 h-4" /> 企业福利卡账户 (全品类通兑)
            </span>
            <span className="bg-white/20 text-yellow-300 px-2 py-0.5 rounded text-[10px] font-bold">季度额度已发放</span>
          </div>

          <div className="text-3xl font-black font-mono mt-2">¥{user.welfareBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>

          <div className="mt-4 pt-3 border-t border-white/20 text-[11px] opacity-80 flex items-center justify-between">
            <span>属于【{user.enterpriseName}】统一拨付规则</span>
            <span>无到期扣减限制</span>
          </div>
        </div>

        {/* 餐卡卡片 */}
        <div
          onClick={() => setActiveAccountTab('meal')}
          className={`p-6 rounded-md cursor-pointer transition-all border shadow-xs ${
            activeAccountTab === 'meal' ? 'bg-gradient-to-r from-[#FF7A00] to-amber-600 text-white border-orange-500 ring-2 ring-orange-400/30' : 'bg-white text-gray-800 border-gray-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-90 mb-2">
            <span className="font-bold flex items-center gap-1.5">
              <Utensils className="w-4 h-4" /> 餐卡专享账户 (食品粮油/餐饮通兑)
            </span>
            <span className="bg-white/20 text-yellow-200 px-2 py-0.5 rounded text-[10px] font-bold">按月定期补扣</span>
          </div>

          <div className="text-3xl font-black font-mono mt-2">¥{user.mealBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>

          <div className="mt-4 pt-3 border-t border-white/20 text-[11px] opacity-80 flex items-center justify-between">
            <span>专用于米面粮油/熟食及合作餐厅体验</span>
            <span>月度结余滚动续用</span>
          </div>
        </div>
      </div>

      {/* 2. 流水筛选与下载对账单 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-gray-900">{activeAccountTab === 'welfare' ? '福利卡交易与发放流水' : '餐卡交易与对账流水'}</h2>
            <span className="text-gray-400">共计 {filteredLogs.length} 条记录</span>
          </div>

          <button onClick={downloadStatement} className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer">
            <Download className="w-3.5 h-3.5 text-blue-600" />
            导出账户流水 (CSV)
          </button>
        </div>

        {/* 流水表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                <th className="p-3">交易时间</th>
                <th className="p-3">类型</th>
                <th className="p-3">业务描述 / 关联事由</th>
                <th className="p-3">关联单号</th>
                <th className="p-3 text-right">变动金额</th>
                <th className="p-3 text-right">变动后余额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((log) => {
                const isInflow = log.amount > 0;

                return (
                  <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="p-3 text-gray-500 font-mono whitespace-nowrap">{log.time}</td>
                    <td className="p-3 font-bold whitespace-nowrap">
                      {isInflow ? (
                        <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                          <ArrowDownLeft className="w-3 h-3 text-green-600" /> 额度收入
                        </span>
                      ) : (
                        <span className="text-gray-700 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                          <ArrowUpRight className="w-3 h-3 text-gray-500" /> 订单消费
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-gray-900">{log.title}</td>
                    <td className="p-3 font-mono text-gray-400">{log.orderNo || '-'}</td>
                    <td className={`p-3 text-right font-black font-mono text-sm ${isInflow ? 'text-green-600' : 'text-gray-900'}`}>{isInflow ? `+¥${log.amount.toFixed(2)}` : `-¥${Math.abs(log.amount).toFixed(2)}`}</td>
                    <td className="p-3 text-right font-mono font-bold text-gray-700">¥{log.balanceAfter.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
