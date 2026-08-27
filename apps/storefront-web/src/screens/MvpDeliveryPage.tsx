import React from 'react';
import { BadgeCheck, ChevronRight, CircleAlert, Clock3, CreditCard, PackageCheck, ShieldCheck, Store, UserRoundCheck } from 'lucide-react';
import { useMall } from '../context/MallContext';

const deliveryPlan = [
  {
    period: '当前',
    score: '7.5',
    status: '已完成',
    internal: '商品、订单、福利卡/餐卡、内部支付、退款与对账已跑通。',
    visible: '静态首页预览。',
  },
  {
    period: '第 1 周',
    score: '7.8',
    status: '进行中',
    internal: '分类治理、商品详情字段、搜索筛选与正式货盘导入规范。',
    visible: '首页、类目浏览和商品列表。',
  },
  {
    period: '第 2 周',
    score: '8.1',
    status: '计划中',
    internal: '商品详情、购物车、订单中心、卡券及核销码展示。',
    visible: '商品详情、购物车和我的订单。',
  },
  {
    period: '第 3 周',
    score: '8.4',
    status: '计划中',
    internal: '商品/库存、订单异常、售后审批、财务对账与简易收银联调。',
    visible: '福利账户、下单流程和订单状态。',
  },
  {
    period: '第 4 周',
    score: '8.6–8.8',
    status: '计划中',
    internal: '身份接入准备、首家供应商联调、支付资料准备及压力/安全测试。',
    visible: '完整 MVP 验收演示。',
  },
  {
    period: '第二期',
    score: '9.0+',
    status: '外部联调',
    internal: '微信/支付宝/银联、POS、门店核销、正式小程序和 Android。',
    visible: '移动端与线下闭环。',
  },
];

const openingPlan = [
  ['第 1 天', '首页静态预览'],
  ['第 3 天', '类目、搜索、商品列表'],
  ['第 5 天', '商品详情和权益说明'],
  ['第 7 天', '登录、福利账户、卡券展示'],
  ['第 10 天', '购物车、提交订单、订单查询'],
  ['第 12 天', '内部支付测试、退款/售后状态'],
  ['第 15 天', 'MVP 阶段验收与第二期清单确认'],
];

const icons = [PackageCheck, Store, CreditCard, ShieldCheck, UserRoundCheck, BadgeCheck];

export const MvpDeliveryPage: React.FC = () => {
  const { navigateTo } = useMall();
  return (
    <div className="max-w-[1280px] mx-auto px-4 py-6 space-y-5">
      <section className="rounded-xl bg-gradient-to-br from-[#102E74] to-[var(--sw-brand)] text-white p-6 md:p-8 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="text-blue-200 text-xs font-bold tracking-wider">智慧翼企业福利商城 · 阶段交付看板</p>
            <h1 className="text-2xl md:text-3xl font-black mt-2">两条线推进，逐步开放验收</h1>
            <p className="text-sm text-blue-100 mt-3 max-w-2xl leading-6">内部持续推进真实业务能力；甲方站仅开放已可稳定验收的功能，避免将外部依赖或开发中的模块误呈现为正式上线能力。</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-5 py-3 shrink-0">
            <div className="text-[11px] text-blue-100">当前 MVP 目标评分</div>
            <div className="text-3xl font-black mt-1">8.6–8.8</div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-black text-gray-900">内部开发与甲方可见进度</h2>
              <p className="text-xs text-gray-500 mt-1">每阶段以可验收成果为开放条件，而非单纯按页面数量计算。</p>
            </div>
            <span className="text-xs font-bold text-[var(--sw-brand-dark)] bg-[var(--sw-brand-light)] px-2.5 py-1 rounded">MVP 路线</span>
          </div>
          <div className="space-y-3">
            {deliveryPlan.map(({ period, score, status, internal, visible }, index) => {
              const Icon = icons[index];
              const active = status === '进行中';
              return (
                <div key={period} className={`border rounded-lg p-4 ${active ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className={`w-4 h-4 ${active ? 'text-[var(--sw-brand)]' : 'text-gray-500'}`} />
                    <span className="font-black text-sm text-gray-900">{period}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${status === '已完成' ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{status}</span>
                    <span className="ml-auto text-xs font-black text-[#FF7A00]">目标 {score}</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mt-3 text-xs leading-5">
                    <p className="text-gray-600">
                      <b className="text-gray-800">内部：</b>
                      {internal}
                    </p>
                    <p className="text-gray-600">
                      <b className="text-gray-800">甲方可见：</b>
                      {visible}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-black text-gray-900">甲方站开放节奏</h2>
            <div className="mt-4 space-y-3">
              {openingPlan.map(([day, content]) => (
                <div key={day} className="flex gap-3 text-xs">
                  <Clock3 className="w-4 h-4 text-[var(--sw-brand)] shrink-0 mt-0.5" />
                  <div>
                    <b className="text-gray-900">{day}</b>
                    <p className="text-gray-500 mt-0.5">{content}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex gap-2">
              <CircleAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <h2 className="font-black text-amber-950 text-sm">外部依赖单独排期</h2>
                <p className="text-xs leading-5 text-amber-900 mt-2">企业 SSO、供应商 API 与支付商户号须以甲方资料、第三方审核和联调结果为准，不计入纯开发工期。</p>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-black text-gray-900">正式商城的四个真实闭环</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {['真实商品', '真实员工身份', '真实供应商履约', '真实支付与财务对账'].map((label, index) => (
            <React.Fragment key={label}>
              <div className="bg-gray-50 border border-gray-200 rounded p-4 text-center text-sm font-black text-gray-800">{label}</div>
              {index < 3 && <ChevronRight className="hidden lg:block absolute" />}
            </React.Fragment>
          ))}
        </div>
        <button onClick={() => navigateTo('mvp-console')} className="mt-5 text-xs font-bold text-[var(--sw-brand)] hover:underline">
          返回 MVP 验收工作台
        </button>
      </section>
    </div>
  );
};
