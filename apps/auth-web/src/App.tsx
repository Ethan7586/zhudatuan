/**
 * 智慧翼企业福利商城 - 应用入口 App.tsx
 * 正式统一登录入口
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { MallProvider } from './context/MallContext';
import { LoginPage } from './screens/LoginPage';

export default function App() {
  return (
    <MallProvider>
      <LoginPage />
    </MallProvider>
  );
}
