import React, { useState } from 'react';
import { useMall } from '../../context/MallContext';
import { AndroidStatusBar } from '../../components/mobile/AndroidStatusBar';
import { AndroidBottomNav } from '../../components/mobile/AndroidBottomNav';
import { CreditCard, Utensils, Package, Clock, Truck, CheckCircle, HelpCircle, Ticket, MapPin, FileText, Bell, Fingerprint, ShieldCheck, ChevronRight, Building2, Smartphone, Settings, Lock, Headphones, Info } from 'lucide-react';

export const AndroidProfilePage: React.FC = () => {
  const { user, currentMall, triggerPendingFeature, setAndroidPage } = useMall();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const handleBiometricToggle = () => {
    triggerPendingFeature('Android Biometric Hardware 授权', '开关硬件指纹/FaceID 免密识别，需接入 Android KeyStore 硬件秘钥。');
    setBiometricsEnabled(!biometricsEnabled);
  };

  const handlePushToggle = () => {
    triggerPendingFeature('Android FCM / 极光 Push 消息推送', '开启系统通知通道（Android NotificationChannel）。');
    setPushEnabled(!pushEnabled);
  };

  return (
    <div className="bg-[#F5F7FA] min-h-full flex flex-col font-sans text-gray-800 relative pb-16">
      <AndroidStatusBar title="个人中心 (Material 3)" />

      {/* User Header Profile Card */}
      <div className="bg-[var(--sw-brand-dark)] text-white p-4 pt-2 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/80 shadow-md flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center text-xl font-black border-2 border-white/80 shadow-md flex-shrink-0">{user.name.slice(0, 1)}</div>
          )}
          <div className="overflow-hidden space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">{user.name}</h2>
              <span className="bg-yellow-400 text-gray-900 text-[9px] font-bold px-2 py-0.2 rounded-full">{user.jobTitle}</span>
            </div>
            <div className="text-[11px] text-blue-100 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-yellow-300" />
              <span className="truncate">{user.enterpriseName}</span>
            </div>
            <div className="text-[10px] text-emerald-200 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-emerald-300" />
              <span>{user.phoneVerified ? '手机已验证，可使用支付功能' : '账号已认证，手机待验证'}</span>
            </div>
          </div>
        </div>

        {/* Material 3 Accounts Row */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div
            onClick={() => triggerPendingFeature('Android 福利卡账单记录', '调起 Android 账单明细列表。')}
            className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/20 cursor-pointer active:bg-white/20 transition-colors"
          >
            <div className="flex items-center justify-between text-[10px] text-blue-100">
              <span className="flex items-center gap-1 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-yellow-300" />
                福利卡余额
              </span>
              <span>明细 &gt;</span>
            </div>
            <div className="text-base font-black text-white font-mono mt-0.5">¥{user.welfareBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
          </div>

          <div onClick={() => triggerPendingFeature('Android 餐卡账单记录', '调起 Android 餐卡消耗记录。')} className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/20 cursor-pointer active:bg-white/20 transition-colors">
            <div className="flex items-center justify-between text-[10px] text-blue-100">
              <span className="flex items-center gap-1 font-medium">
                <Utensils className="w-3.5 h-3.5 text-amber-300" />
                餐卡余额
              </span>
              <span>明细 &gt;</span>
            </div>
            <div className="text-base font-black text-white font-mono mt-0.5">¥{user.mealBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        {/* Orders Grid Card */}
        <div className="bg-white rounded-3xl p-3.5 shadow-2xs border border-gray-100 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 text-xs">
            <h3 className="font-bold text-gray-900 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[var(--sw-brand)]" />
              <span>企采订单中心</span>
            </h3>
            <button onClick={() => setAndroidPage('orders')} className="text-[10px] text-gray-400 hover:text-[var(--sw-brand)] flex items-center">
              <span>全部订单</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div onClick={() => triggerPendingFeature('Android 待付款列表', '查看等待付款或额度补足的订单。')} className="p-1 hover:bg-gray-50 rounded-2xl cursor-pointer">
              <div className="w-9 h-9 mx-auto rounded-2xl bg-blue-50 text-[var(--sw-brand)] flex items-center justify-center font-bold">
                <Clock className="w-4.5 h-4.5" />
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-medium">待付款</div>
            </div>

            <div onClick={() => triggerPendingFeature('Android 待发货列表', '查看物流状态。')} className="p-1 hover:bg-gray-50 rounded-2xl cursor-pointer relative">
              <div className="w-9 h-9 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Truck className="w-4.5 h-4.5" />
                <span className="absolute top-0 right-2 bg-red-500 text-white font-bold text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center">2</span>
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-medium">待处理</div>
            </div>

            <div onClick={() => triggerPendingFeature('Android 待收货列表', '确认收到企采快递。')} className="p-1 hover:bg-gray-50 rounded-2xl cursor-pointer">
              <div className="w-9 h-9 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle className="w-4.5 h-4.5" />
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-medium">已完成</div>
            </div>

            <div onClick={() => triggerPendingFeature('Android 售后退换记录', '申请退货或补发。')} className="p-1 hover:bg-gray-50 rounded-2xl cursor-pointer">
              <div className="w-9 h-9 mx-auto rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <HelpCircle className="w-4.5 h-4.5" />
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-medium">售后单</div>
            </div>
          </div>
        </div>

        {/* Android Native Settings List (Biometrics, Push Notifications tagged "接口待接入") */}
        <div className="bg-white rounded-3xl p-3.5 shadow-2xs border border-gray-100 space-y-2 text-xs">
          <div className="text-[11px] text-gray-400 font-bold px-1 uppercase tracking-wider">Android 系统安全与扩展 (接口待接入)</div>

          <div className="divide-y divide-gray-100 text-gray-700">
            {/* Biometrics Toggle */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <Fingerprint className="w-4 h-4 text-purple-600" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span>指纹 / FaceID 生物识别支付</span>
                    <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">接口待接入</span>
                  </div>
                  <div className="text-[10px] text-gray-400">Android Biometric Manager API</div>
                </div>
              </div>
              <button onClick={handleBiometricToggle} className={`w-10 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${biometricsEnabled ? 'bg-[var(--sw-brand)]' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${biometricsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Push Notifications Toggle */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <Bell className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span>系统 Notification 消息推送</span>
                    <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">接口待接入</span>
                  </div>
                  <div className="text-[10px] text-gray-400">Android Notification Channel</div>
                </div>
              </div>
              <button onClick={handlePushToggle} className={`w-10 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${pushEnabled ? 'bg-[var(--sw-brand)]' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${pushEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Address Management */}
            <button
              onClick={() => triggerPendingFeature('Android 企采常用地址', '管理公司宿舍与企业总部配送点。')}
              className="w-full py-2.5 flex items-center justify-between hover:bg-gray-50 px-1 rounded-lg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 font-medium">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <span>收货地址中心</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>

            {/* Invoice Header */}
            <button onClick={() => triggerPendingFeature('Android 发票抬头配置', '快速切换专票与普票信息。')} className="w-full py-2.5 flex items-center justify-between hover:bg-gray-50 px-1 rounded-lg transition-colors cursor-pointer">
              <div className="flex items-center gap-2 font-medium">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>发票抬头发票包</span>
              </div>
              <span className="text-gray-400 text-[10px]">中国建筑集团 &gt;</span>
            </button>
          </div>
        </div>

        {/* Tech Info */}
        <div className="bg-white rounded-3xl p-3.5 shadow-2xs border border-gray-100 space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-700">
            <span className="font-bold flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600" />
              <span>关于智慧翼 Android 客户端</span>
            </span>
            <span className="text-gray-400 font-mono text-[10px]">v2.8.0</span>
          </div>

          <div className="text-[11px] text-gray-500 leading-relaxed pt-1 border-t border-gray-100">
            <div>技术服务方：雍彻科技（SGSYEN TECH）</div>
            <div>系统架构：Material 3 Native B2B2C Enterprise Architecture</div>
          </div>
        </div>
      </div>

      <AndroidBottomNav />
    </div>
  );
};
