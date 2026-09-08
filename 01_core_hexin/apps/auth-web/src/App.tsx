/**
 * 智慧翼企业福利商城 - 应用入口 App.tsx
 * 正式统一登录入口
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { MallProvider } from './context/MallContext';
import { ConsumerIdentityPage } from './screens/ConsumerIdentityPage';
import { OperatorIdentityPage } from './screens/OperatorIdentityPage';
import { resolveIdentityEntry } from './services/consumerIdentityEntry';

export default function App() {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const entry = resolveIdentityEntry(search, hostname);
  return (
    <MallProvider>
      {entry === null
        ? <InvalidIdentityEntryPage hostname={hostname} />
        : entry.kind === 'operator'
          ? <OperatorIdentityPage target={entry.target} expectedOrigin={entry.adminOrigin} displayName={entry.displayName} />
          : <ConsumerIdentityPage application={entry.application} />}
    </MallProvider>
  );
}

function InvalidIdentityEntryPage({ hostname }: Readonly<{ hostname: string }>) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20 text-slate-950">
      <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-blue-700">统一身份中心</p>
        <h1 className="mt-3 text-3xl font-black">登录入口与节点不匹配</h1>
        <p className="mt-4 leading-7 text-slate-600">当前地址 {hostname || '未知'} 未登记为可用身份入口，请从所属节点重新进入登录。</p>
      </section>
    </main>
  );
}
