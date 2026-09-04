import React from 'react';
import { useMall } from '../../context/MallContext';
import { WeChatCapsule } from '../../components/mobile/WeChatCapsule';
import { WeChatTabBar } from '../../components/mobile/WeChatTabBar';
import { CreditCard, Utensils, Package, Clock, Truck, CheckCircle, HelpCircle, Ticket, MapPin, FileText, BellRing, Headphones, ShieldCheck, ChevronRight, Building2, Smartphone } from 'lucide-react';

export const MPProfilePage: React.FC = () => {
  const { user, currentMall, triggerPendingFeature, setMpPage } = useMall();

  return (
    <div className="bg-[#F5F7FA] min-h-full flex flex-col font-sans text-gray-800 pb-16">
      <WeChatCapsule title="个人中心" />

      {/* Profile Header Header Box */}
      <div className="bg-gradient-to-b from-[var(--sw-brand-dark)] to-[var(--sw-brand)] text-white p-4 pt-2 shadow-sm space-y-3">
        {/* User Card */}
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-full object-cover border-2 border-white/80 shadow-md flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center text-xl font-black border-2 border-white/80 shadow-md flex-shrink-0">{user.name.slice(0, 1)}</div>
          )}
          <div className="overflow-hidden space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">{user.name}</h2>
              <span className="bg-yellow-400 text-gray-900 text-[9px] font-bold px-1.5 py-0.2 rounded">{user.jobTitle}</span>
            </div>
            <div className="text-[11px] text-blue-100 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-yellow-300" />
              <span className="truncate">{user.enterpriseName}</span>
            </div>
            <div className="text-[10px] text-emerald-200 flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-emerald-300" />
              <span>微信手机号已安全绑定 (138****8888)</span>
            </div>
          </div>
        </div>

        {/* Welfare Balances Row inside header */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div
            onClick={() => triggerPendingFeature('微信小程序 福利卡账单', '查看企业按月发放的福利卡明细。')}
            className="bg-white/15 backdrop-blur-xs p-2.5 rounded-xl border border-white/20 cursor-pointer active:bg-white/25 transition-colors"
          >
            <div className="flex items-center justify-between text-[10px] text-blue-100">
              <span className="flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-yellow-300" />
                福利卡余额
              </span>
              <span>明细 &gt;</span>
            </div>
            <div className="text-base font-black text-white font-mono mt-0.5">¥{user.welfareBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
          </div>

          <div onClick={() => triggerPendingFeature('微信小程序 餐卡账单', '查看餐卡专享扣减明细。')} className="bg-white/15 backdrop-blur-xs p-2.5 rounded-xl border border-white/20 cursor-pointer active:bg-white/25 transition-colors">
            <div className="flex items-center justify-between text-[10px] text-blue-100">
              <span className="flex items-center gap-1">
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
        {/* Orders Status Grid */}
        <div className="bg-white rounded-2xl p-3 shadow-xs border border-gray-100 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 text-xs">
            <h3 className="font-bold text-gray-900 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[var(--sw-brand)]" />
              <span>我的福利订单</span>
            </h3>
            <button onClick={() => setMpPage('orders')} className="text-[10px] text-gray-400 hover:text-[var(--sw-brand)] flex items-center">
              <span>全部订单</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <button onClick={() => triggerPendingFeature('待付款订单', '查看待付款或待补额的企采订单。')} className="p-1 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
              <div className="w-8 h-8 mx-auto rounded-full bg-blue-50 text-[var(--sw-brand)] flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-medium">待付款</div>
            </button>

            <button onClick={() => triggerPendingFeature('待发货订单', '查看待供应商仓储理货发货的订单。')} className="p-1 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer relative">
              <div className="w-8 h-8 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Truck className="w-4 h-4" />
                <span className="absolute top-0 right-2 bg-red-500 text-white font-bold text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center">2</span>
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-medium">待处理</div>
            </button>

            <button onClick={() => triggerPendingFeature('待收货订单', '查看物流派件轨迹。')} className="p-1 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
              <div className="w-8 h-8 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-medium">已完成</div>
            </button>

            <button onClick={() => triggerPendingFeature('售后退款记录', '提交商品质保与发票退换。')} className="p-1 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
              <div className="w-8 h-8 mx-auto rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="text-[10px] text-gray-600 mt-1 font-medium">售后服务</div>
            </button>
          </div>
        </div>

        {/* Welfare Tools & Cards */}
        <div className="bg-white rounded-2xl p-3 shadow-xs border border-gray-100 space-y-2 text-xs">
          <div className="text-[11px] text-gray-400 font-bold px-1 uppercase tracking-wider">企采资产与常用工具</div>

          <div className="divide-y divide-gray-100 text-gray-700">
            <button
              onClick={() => triggerPendingFeature('我的虚拟卡券包', '出示核销二维码或管理已领取的星巴克代金券/电影票。')}
              className="w-full py-2.5 flex items-center justify-between hover:bg-gray-50 px-1 rounded-lg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 font-medium">
                <Ticket className="w-4 h-4 text-orange-500" />
                <span>我的卡券包</span>
              </div>
              <span className="text-[var(--sw-brand)] font-bold flex items-center text-[10px]">
                <span>3 张可用</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-0.5" />
              </span>
            </button>

            <button onClick={() => triggerPendingFeature('常用企采收货地址', '管理员工宿舍与企业大楼配送地址。')} className="w-full py-2.5 flex items-center justify-between hover:bg-gray-50 px-1 rounded-lg transition-colors cursor-pointer">
              <div className="flex items-center gap-2 font-medium">
                <MapPin className="w-4 h-4 text-blue-500" />
                <span>收货地址管理</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
            </button>

            <button
              onClick={() => triggerPendingFeature('企业发票抬头信息', '自动填充中国建筑集团增值税专票抬头。')}
              className="w-full py-2.5 flex items-center justify-between hover:bg-gray-50 px-1 rounded-lg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 font-medium">
                <FileText className="w-4 h-4 text-emerald-500" />
                <span>开票信息配置</span>
              </div>
              <span className="text-gray-400 text-[10px]">专票/普票抬头 &gt;</span>
            </button>
          </div>
        </div>

        {/* Extended Mobile Native Settings (接口待接入) */}
        <div className="bg-white rounded-2xl p-3 shadow-xs border border-gray-100 space-y-2 text-xs">
          <div className="text-[11px] text-gray-400 font-bold px-1 uppercase tracking-wider">平台设置与支持</div>

          <div className="divide-y divide-gray-100 text-gray-700">
            <button
              onClick={() => triggerPendingFeature('微信小程序服务通知消息订阅', '开启端内订单物流变动与福利卡发放通知。')}
              className="w-full py-2.5 flex items-center justify-between hover:bg-gray-50 px-1 rounded-lg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 font-medium">
                <BellRing className="w-4 h-4 text-purple-500" />
                <span>服务通知推送订阅</span>
              </div>
              <span className="text-xs text-amber-600 bg-amber-50 font-bold px-1.5 py-0.2 rounded border border-amber-200">接口待接入</span>
            </button>

            <button onClick={() => triggerPendingFeature('微信企微客服', '调起企业微信客服小助手。')} className="w-full py-2.5 flex items-center justify-between hover:bg-gray-50 px-1 rounded-lg transition-colors cursor-pointer">
              <div className="flex items-center gap-2 font-medium">
                <Headphones className="w-4 h-4 text-indigo-500" />
                <span>企采专属客服专线</span>
              </div>
              <span className="text-gray-400 text-[10px]">工作日 09:00-18:00 &gt;</span>
            </button>

            <button
              onClick={() => triggerPendingFeature('企业员工身份验证状态', '核验当前微信账号与集团 HR 系统的绑定状态。')}
              className="w-full py-2.5 flex items-center justify-between hover:bg-gray-50 px-1 rounded-lg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>企业安全认证凭证</span>
              </div>
              <span className={`${user.phoneVerified ? 'text-emerald-600' : 'text-amber-600'} font-bold text-[10px]`}>{user.phoneVerified ? '手机已验证' : '手机待验证'} &gt;</span>
            </button>
          </div>
        </div>

        <div className="text-center py-2 text-[10px] text-gray-400">
          <div>智慧翼企业福利商城 v2.8.0</div>
          <div>技术服务方：雍彻科技（SGSYEN TECH）</div>
        </div>
      </div>

      <WeChatTabBar />
    </div>
  );
};
