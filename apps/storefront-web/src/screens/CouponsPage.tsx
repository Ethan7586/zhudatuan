/**
 * 智慧翼企业福利商城 - 我的卡券包 CouponsPage screen
 * 托管电子电影票、商超电子卡、附近门店核销券，支持实时动态QR码出示与模拟门店核销
 * 技术服务方：雍彻科技
 */

import React, { useState } from 'react';
import { useMall } from '../context/MallContext';
import { UserCoupon } from '../types';
import { Ticket, QrCode, CheckCircle2, Clock, Building, Store, Sparkles, Copy, X, CreditCard } from 'lucide-react';

export const CouponsPage: React.FC = () => {
  const { user, showToast } = useMall();

  const [activeTab, setActiveTab] = useState<'unused' | 'used' | 'expired'>('unused');
  const [selectedCoupon, setSelectedCoupon] = useState<UserCoupon | null>(null);

  // The coupon API has not shipped yet. Production never falls back to the
  // browser demo persona's coupon wallet.
  const coupons: UserCoupon[] = [];
  const filteredCoupons = coupons.filter((c) => c.status === activeTab);

  const handleSimulateVerification = (couponId: string) => {
    showToast(`卡券 ${couponId} 的生产核销接口尚未接通，当前未修改任何数据`, 'warning');
    setSelectedCoupon(null);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast(`核销卡密已复制：${code}`, 'success');
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-4 font-sans text-xs">
      {/* 1. 顶栏 Tab 状态筛选 */}
      <div className="bg-white border border-gray-200 rounded-md p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <Ticket className="w-5 h-5 text-[#FF7A00]" />
          <h1 className="text-base text-gray-900">员工电子卡券与影城门票包</h1>
        </div>

        <div className="flex items-center gap-1 font-bold">
          {[
            {
              id: 'unused',
              label: `未使用 (${coupons.filter((c) => c.status === 'unused').length})`,
            },
            { id: 'used', label: `已核销 (${coupons.filter((c) => c.status === 'used').length})` },
            {
              id: 'expired',
              label: `已失效 (${coupons.filter((c) => c.status === 'expired').length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 rounded transition-colors cursor-pointer ${activeTab === tab.id ? 'bg-[var(--sw-brand)] text-white font-black' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 卡券网格列表 */}
      {filteredCoupons.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-12 text-center space-y-3">
          <Ticket className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-700">暂无相关卡券记录</h3>
          <p className="text-gray-400">您可以在商城首页选择电影票、商超卡包或附近门店服务兑换。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.map((coupon) => {
            const isUnused = coupon.status === 'unused';

            return (
              <div key={coupon.id} className={`bg-white border rounded-md shadow-xs overflow-hidden transition-all flex flex-col justify-between ${isUnused ? 'border-orange-300 hover:shadow-md' : 'border-gray-200 opacity-60'}`}>
                {/* 卡头标识 */}
                <div
                  className={`p-4 text-white flex items-center justify-between ${
                    coupon.type === 'movie_ticket'
                      ? 'bg-gradient-to-r from-purple-700 to-indigo-800'
                      : coupon.type === 'supermarket' || coupon.type === 'virtual_coupon'
                        ? 'bg-gradient-to-r from-emerald-700 to-teal-800'
                        : 'bg-gradient-to-r from-orange-600 to-amber-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold">{coupon.type === 'movie_ticket' ? '影城门票' : coupon.type === 'supermarket' ? '电子商超卡' : '门店核销券'}</span>
                    <span className="font-bold text-sm truncate max-w-[150px]">{coupon.title}</span>
                  </div>

                  <span className="text-xl font-black font-mono">¥{coupon.faceValue}</span>
                </div>

                {/* 卡体说明 */}
                <div className="p-4 space-y-3 flex-1">
                  <div className="text-gray-600 leading-relaxed font-medium">{coupon.usageRules?.join(' · ') || '企业福利专属兑换券'}</div>

                  <div className="text-[11px] text-gray-400 space-y-1 pt-2 border-t border-gray-100">
                    <div>适用对象/门店：{coupon.storeName || '全平台通用/合作影影城门店'}</div>
                    <div>有效期限：{coupon.expiryDate} 前可用</div>
                    <div className="font-mono text-gray-700 font-bold">核销券码：{coupon.code}</div>
                  </div>
                </div>

                {/* 卡底操作栏 */}
                <div className="bg-gray-50 border-t border-gray-100 p-3 flex items-center justify-between">
                  <button onClick={() => copyCode(coupon.code)} className="text-gray-500 hover:text-gray-800 font-medium flex items-center gap-1 cursor-pointer">
                    <Copy className="w-3.5 h-3.5" /> 复制券码
                  </button>

                  {isUnused ? (
                    <button onClick={() => setSelectedCoupon(coupon)} className="bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded flex items-center gap-1 cursor-pointer shadow-2xs">
                      <QrCode className="w-3.5 h-3.5" /> 出示核销码 / 到店核销
                    </button>
                  ) : (
                    <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded font-bold">{coupon.status === 'used' ? '已于门店核销' : '已过期失效'}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: 核销动态二维码与模拟核销 */}
      {selectedCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-md p-6 max-w-sm w-full space-y-4 text-center relative shadow-2xl">
            <button onClick={() => setSelectedCoupon(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 p-1">
              <X className="w-5 h-5" />
            </button>

            <div className="font-bold text-sm text-gray-900 border-b pb-2">出示二维码与卡密核销</div>

            <div className="space-y-1">
              <div className="font-bold text-base text-gray-800">{selectedCoupon.title}</div>
              <div className="text-gray-500 text-xs">{selectedCoupon.storeName || '线上线下全网通兑'}</div>
            </div>

            {/* 模拟二维码容器 */}
            <div className="bg-gray-50 border border-gray-300 rounded p-4 mx-auto w-48 h-48 flex flex-col items-center justify-center space-y-2 shadow-inner">
              <QrCode className="w-32 h-32 text-gray-900" />
              <div className="text-[10px] text-gray-400">动态更新 · 防伪校验</div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-900 font-mono font-black text-base tracking-widest">{selectedCoupon.code}</div>

            <div className="text-[11px] text-gray-400">请向门店收银员出示此码，或在合作小程序/猫眼APP内直接输入使用。</div>

            <div className="pt-2">
              <button onClick={() => handleSimulateVerification(selectedCoupon.id)} className="w-full bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-black py-2.5 rounded text-xs transition-colors cursor-pointer shadow-md">
                模拟门店扫码核销 (完成核销)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
