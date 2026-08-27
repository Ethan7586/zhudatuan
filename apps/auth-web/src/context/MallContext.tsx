/**
 * 智慧翼企业福利商城 - MallContext 状态上下文
 * 技术服务方：雍彻科技
 */

import React, { createContext, useContext, useState } from 'react';
import { DomainType, MallContextType, ScreenType } from '../types';

const MallContext = createContext<MallContextType | undefined>(undefined);

function initialDomain(): DomainType {
  if (typeof window === 'undefined') return 'zhudatuan.com';
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'console.zhudatuan.com') return 'console.zhudatuan.com';
  if (hostname === 'smart.hbbtzn.com') return 'smart.hbbtzn.com';
  if (hostname === 'hbbtzn.com' || hostname === 'www.hbbtzn.com') return 'hbbtzn.com';
  return 'zhudatuan.com';
}

export const MallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentDomain, setDomain] = useState<DomainType>(initialDomain);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('login');
  const [screenParams, setScreenParams] = useState<Record<string, any>>({});
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<any>(null);

  const navigateTo = (screen: ScreenType, params?: Record<string, any>) => {
    setCurrentScreen(screen);
    setScreenParams(params || {});
  };

  return (
    <MallContext.Provider
      value={{
        currentDomain,
        setDomain,
        currentScreen,
        screenParams,
        navigateTo,
        acceptedTerms,
        setAcceptedTerms,
        activeSession,
        setActiveSession,
      }}
    >
      {children}
    </MallContext.Provider>
  );
};

export const useMallContext = (): MallContextType => {
  const context = useContext(MallContext);
  if (!context) {
    throw new Error('useMallContext must be used within a MallProvider');
  }
  return context;
};
