import React from 'react';
import { Boxes, Database, Network, ShieldCheck } from 'lucide-react';
import { ArchitectureCanvas } from '../features/architecture/ArchitectureCanvas';

const LAYERS = [
  { icon: Network, title: '全端接入', text: 'PC、笔记本、小程序、Android 与平板共用业务契约。' },
  {
    icon: ShieldCheck,
    title: '边缘安全',
    text: 'Cloudflare Worker 负责会话、权限、限流和输入校验。',
  },
  { icon: Boxes, title: '业务分域', text: '商品、订单、账户、售后与供应商适配职责分离。' },
  { icon: Database, title: '数据治理', text: 'Supabase PostgreSQL、RLS、审计流水与隐私加密。' },
];

export const ArchitecturePage: React.FC = () => (
  <div className="max-w-[1280px] mx-auto px-4 py-6 space-y-5 font-sans">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
      <div>
        <div className="text-xs font-bold text-[var(--sw-brand)]">SGSYEN TECH · SYSTEM BLUEPRINT</div>
        <h1 className="text-2xl font-black text-slate-900 mt-1">智慧翼企业福利商城架构图</h1>
        <p className="text-sm text-slate-500 mt-2">Canvas 实时绘制的生产型 MVP 全端架构；点击节点可查看职责。</p>
      </div>
      <span className="text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5">架构基线 v1.0 · 2026-07-24</span>
    </div>
    <ArchitectureCanvas />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {LAYERS.map(({ icon: Icon, title, text }) => (
        <div key={title} className="bg-white border border-slate-200 rounded-lg p-4">
          <Icon className="w-5 h-5 text-[var(--sw-brand)]" />
          <h2 className="font-bold text-sm text-slate-900 mt-2">{title}</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{text}</p>
        </div>
      ))}
    </div>
  </div>
);
