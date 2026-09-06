/**
 * 智慧翼企业福利商城 - 应用入口 App.tsx
 * 正式统一登录入口
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { MallProvider } from './context/MallContext';
import { ConsumerIdentityPage } from './screens/ConsumerIdentityPage';
import { OperatorIdentityPage } from './screens/OperatorIdentityPage';
import { resolveConsumerIdentityEntry } from './services/consumerIdentityEntry';

export default function App() {
  const consumerEntry = resolveConsumerIdentityEntry(typeof window === 'undefined' ? '' : window.location.search);
  return (
    <MallProvider>
      {consumerEntry === null
        ? <OperatorIdentityPage />
        : <ConsumerIdentityPage application={consumerEntry.application} />}
    </MallProvider>
  );
}
