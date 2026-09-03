/**
 * 智慧翼企业福利商城 - 页脚 Footer 组件
 * 呈现企业福利架构与平台公信力
 * 标注技术服务方：雍彻科技
 */

import React from 'react';
import { useNavigate } from 'react-router';
import { useShellRuntime } from './ShellRuntime';
import { ShieldCheck, Truck, CreditCard, Headphones, Building2, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  const { currentMall, navigateTo } = useShellRuntime();
  const navigate = useNavigate();

  return (
    <footer className="storefrontfooter w-full bg-[var(--sw-brand-ink)] text-gray-300 text-xs font-sans mt-12 border-t border-gray-800 select-none">
      {/* 1. 顶部四大承诺与保障 */}
      <div className="border-b border-gray-800 bg-gray-900/60 py-6">
        <div className="sw-web-container max-w-[1280px] mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[var(--sw-brand)]">
              <ShieldCheck className="w-5 h-5 text-[var(--sw-brand)]" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">已发布商品可追溯</div>
              <div className="text-gray-400 text-[11px] mt-0.5">来源与供应商以商品记录为准</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[var(--sw-brand)]">
              <CreditCard className="w-5 h-5 text-[var(--sw-brand)]" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">服务端权威报价</div>
              <div className="text-gray-400 text-[11px] mt-0.5">账户资格与支付拆分逐单校验</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[var(--sw-brand)]">
              <Truck className="w-5 h-5 text-[var(--sw-brand)]" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">履约状态全程追踪</div>
              <div className="text-gray-400 text-[11px] mt-0.5">物流与电子权益按订单时间线展示</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[var(--sw-brand)]">
              <Headphones className="w-5 h-5 text-[var(--sw-brand)]" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">客服工单持续跟踪</div>
              <div className="text-gray-400 text-[11px] mt-0.5">响应与解决时间以工单服务时限为准</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 底部栏目链接 */}
      <div className="sw-web-container max-w-[1280px] mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div>
          <div className="font-bold text-white text-sm mb-3 border-l-2 border-[var(--sw-brand)] pl-2">关于商城</div>
          <ul className="space-y-2 text-gray-400">
            <FooterLink onPress={() => void navigate('/')}>商城简介</FooterLink>
            <FooterLink onPress={() => void navigate('/support?topic=welfare')}>企业福利解决方案</FooterLink>
            <FooterLink onPress={() => void navigate('/support?topic=supplier')}>供应商入驻标准</FooterLink>
            <FooterLink onPress={() => void navigate('/support?topic=distributor')}>分销服务商政策</FooterLink>
          </ul>
        </div>

        <div>
          <div className="font-bold text-white text-sm mb-3 border-l-2 border-[var(--sw-brand)] pl-2">福利与账户</div>
          <ul className="space-y-2 text-gray-400">
            <FooterLink onPress={() => navigateTo('balance', { accountTab: 'welfare' })}>福利卡充值与规则</FooterLink>
            <FooterLink onPress={() => navigateTo('balance', { accountTab: 'meal' })}>餐卡使用规则与补差</FooterLink>
            <FooterLink onPress={() => navigateTo('coupons')}>电子卡券与核销指南</FooterLink>
            <FooterLink onPress={() => navigateTo('balance')}>账户交易日志查询</FooterLink>
          </ul>
        </div>

        <div>
          <div className="font-bold text-white text-sm mb-3 border-l-2 border-[var(--sw-brand)] pl-2">购物与配送</div>
          <ul className="space-y-2 text-gray-400">
            <FooterLink onPress={() => navigateTo('orders')}>订单查询与跟踪</FooterLink>
            <FooterLink onPress={() => navigateTo('cart')}>合并结算与供应商拆单</FooterLink>
            <FooterLink onPress={() => void navigate('/orders?view=invoices')}>发票开具（企业/个人）</FooterLink>
            <FooterLink onPress={() => void navigate('/support?topic=delivery')}>配送时效与运费说明</FooterLink>
          </ul>
        </div>

        <div>
          <div className="font-bold text-white text-sm mb-3 border-l-2 border-[var(--sw-brand)] pl-2">售后与保障</div>
          <ul className="space-y-2 text-gray-400">
            <FooterLink onPress={() => navigateTo('orders', { statusFilter: 'after_sale' })}>退换货流程与申请</FooterLink>
            <FooterLink onPress={() => void navigate('/support?topic=voucher')}>虚拟卡券挂失与补发</FooterLink>
            <FooterLink onPress={() => void navigate('/support?topic=verification')}>线下门店核销维权</FooterLink>
            <FooterLink onPress={() => void navigate('/profile/security')}>隐私保护与合规承诺</FooterLink>
          </ul>
        </div>

        {/* 平台授权与技术服务方 */}
        <div className="bg-gray-800/60 p-4 rounded-md border border-gray-700/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-white font-bold text-sm mb-2">
              <Building2 className="w-4 h-4 text-[var(--sw-brand)]" />
              <span>{currentMall.enterpriseName}</span>
            </div>
            <p className="storefrontauthorizedcopy text-[11px] leading-relaxed">
              本商城由【{currentMall.enterpriseName}
              】统一授权搭建，专为集团员工提供全品类福利兑换与特惠商品采购服务。
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-700/80">
            <div className="text-[11px] text-gray-400">项目状态：</div>
            <div className="text-sm font-black text-white mt-0.5">智慧翼福利商城</div>
            <div className="text-[10px] text-gray-300 mt-1">技术服务：雍彻科技</div>
          </div>
        </div>
      </div>

      {/* 3. 版权、备案与技术服务方标志 */}
      <div className="border-t border-gray-800 bg-gray-950 py-5 text-center text-gray-300 text-[11px]">
        <div className="sw-web-container max-w-[1280px] mx-auto px-4 space-y-2">
          <div className="flex items-center justify-center gap-4 flex-wrap text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-[var(--sw-success)] rounded-full inline-block animate-pulse"></span>
              商城数据在线校验
            </span>
            <span>·</span>
            <span>安全连接 · 隐私保护</span>
            <span>·</span>
            <span className="font-bold text-white bg-blue-900/60 border border-blue-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-yellow-300" />
              技术服务方：雍彻科技
            </span>
          </div>

          <div>© 2026 智慧翼企业福利商城 · 保留所有权利 · 技术服务：雍彻科技</div>

          <div className="text-gray-400 text-[10px]">商品、库存、企业权益与订单状态以登录账户的实时数据为准。</div>
        </div>
      </div>
    </footer>
  );
};

function FooterLink({ children, onPress }: Readonly<{ children: React.ReactNode; onPress: () => void }>) {
  return (
    <li>
      <button type="button" className="hover:text-white transition-colors cursor-pointer text-left" onClick={onPress}>
        {children}
      </button>
    </li>
  );
}
