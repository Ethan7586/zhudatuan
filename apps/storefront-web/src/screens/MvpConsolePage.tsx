import React, { useEffect, useState } from 'react';
import { Activity, Boxes, CheckCircle2, Database, FileCheck2, LockKeyhole, PackageCheck, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useMall } from '../context/MallContext';
import { productionApi } from '../services/productionApi';

interface HealthState {
  status: string;
  database: string;
  authentication: string;
  encryption: string;
  region: string;
}

export const MvpConsolePage: React.FC = () => {
  const { products, orders, user, sessionStatus, navigateTo, refreshProductionData, showToast } = useMall();
  const [health, setHealth] = useState<HealthState | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await productionApi.getHealth();
      setHealth({
        status: result.status,
        database: result.checks.database,
        authentication: result.checks.authentication,
        encryption: result.checks.piiEncryption,
        region: result.database.region,
      });
      if (sessionStatus === 'authenticated') await refreshProductionData();
      showToast('MVP运行状态已刷新', 'success');
    } catch {
      showToast('暂时无法读取运行状态', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const metrics = [
    { label: '在线商品', value: products.length, icon: Boxes, color: 'text-blue-600' },
    { label: '本人订单', value: orders.length, icon: PackageCheck, color: 'text-orange-600' },
    {
      label: '福利余额',
      value: `¥${user.welfareBalance.toFixed(2)}`,
      icon: ShieldCheck,
      color: 'text-emerald-600',
    },
    {
      label: '餐卡余额',
      value: `¥${user.mealBalance.toFixed(2)}`,
      icon: Users,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">生产型MVP验收工作台</h1>
          <p className="text-xs text-gray-500 mt-1">用于甲方阶段验收、数据链路检查和第三方接入准备，不等同于正式运营后台。</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="bg-[var(--sw-brand-dark)] disabled:bg-blue-300 text-white text-xs font-bold rounded px-4 py-2 flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新运行状态
        </button>
      </div>

      {sessionStatus !== 'authenticated' && <div className="bg-amber-50 border border-amber-200 rounded p-4 text-xs text-amber-900">当前为访客预览。请先通过页面顶部的“登录MVP”建立安全会话，才能核验账户和订单数据。</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-md p-4 shadow-xs">
            <Icon className={`w-5 h-5 ${color}`} />
            <div className="text-[11px] text-gray-500 mt-3">{label}</div>
            <div className="text-lg font-black text-gray-900 mt-1">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-md p-5 space-y-3">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--sw-brand)]" /> 系统健康状态
          </h2>
          {[
            ['服务状态', health?.status ?? '检查中'],
            ['数据库', health?.database ?? '检查中'],
            ['身份会话', health?.authentication ?? '检查中'],
            ['隐私信息加密', health?.encryption ?? '检查中'],
            ['数据库区域', health?.region ?? '检查中'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs border-t border-gray-100 pt-2">
              <span className="text-gray-500">{label}</span>
              <span className="font-bold text-gray-800">{value}</span>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-5 space-y-3">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-600" /> MVP核心闭环
          </h2>
          {[
            ['商品目录与实时库存', Database],
            ['安全会话与权限范围', LockKeyhole],
            ['购物车与加密收货信息', CheckCircle2],
            ['库存原子预占与供应商拆单', CheckCircle2],
            ['福利卡/餐卡组合扣款', CheckCircle2],
            ['幂等、流水与审计', CheckCircle2],
          ].map(([label, Icon]) => {
            const ItemIcon = Icon as typeof CheckCircle2;
            return (
              <div key={label as string} className="flex items-center gap-2 text-xs border-t border-gray-100 pt-2">
                <ItemIcon className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-gray-700">{label as string}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-[var(--sw-brand-light)] border border-blue-200 rounded-md p-5">
        <h2 className="font-bold text-sm text-[var(--sw-brand-dark)]">验收快捷入口</h2>
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            ['阶段交付计划', 'mvp-delivery'],
            ['商品目录', 'category'],
            ['购物车', 'cart'],
            ['订单中心', 'orders'],
            ['账户流水', 'balance'],
            ['个人中心', 'user-center'],
          ].map(([label, page]) => (
            <button
              key={page}
              onClick={() => navigateTo(page as 'mvp-delivery' | 'category' | 'cart' | 'orders' | 'balance' | 'user-center')}
              className="bg-white border border-blue-200 hover:border-[var(--sw-brand)] text-[var(--sw-brand-dark)] text-xs font-bold px-3 py-2 rounded"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
