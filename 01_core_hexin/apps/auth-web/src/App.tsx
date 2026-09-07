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
          ? <OperatorIdentityPage target={entry.target} />
          : <ConsumerIdentityPage application={entry.application} />}
    </MallProvider>
  );
}

function InvalidIdentityEntryPage({ hostname }: Readonly<{ hostname: string }>) {
  const storefront = hostname === 'accounts.hbbtzn.com' ? 'https://hbbtzn.com' : 'https://zhudatuan.com';
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20 text-slate-950">
      <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-blue-700">统一身份中心</p>
        <h1 className="mt-3 text-3xl font-black">登录入口与节点不匹配</h1>
        <p className="mt-4 leading-7 text-slate-600">L0 与 L1 身份相互隔离，请从当前节点商城重新进入登录。</p>
        <a className="mt-8 inline-flex rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white" href={storefront}>
          返回当前节点商城
        </a>
      </section>
    </main>
  );
}
