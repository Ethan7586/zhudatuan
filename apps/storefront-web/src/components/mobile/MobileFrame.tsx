import React, { useState } from 'react';
import { useMall } from '../../context/MallContext';
import { MobileTopBarSwitcher } from './MobileTopBarSwitcher';
import { PendingInterfaceModal } from './PendingInterfaceModal';

// WeChat Mini Program Pages
import { MPHomePage } from '../../features/miniprogram/MPHomePage';
import { MPCategoryPage } from '../../features/miniprogram/MPCategoryPage';
import { MPDetailPage } from '../../features/miniprogram/MPDetailPage';
import { MPCartPage } from '../../features/miniprogram/MPCartPage';
import { MPProfilePage } from '../../features/miniprogram/MPProfilePage';

// Android App Pages
import { AndroidHomePage } from '../../features/android/AndroidHomePage';
import { AndroidSearchPage } from '../../features/android/AndroidSearchPage';
import { AndroidDetailPage } from '../../features/android/AndroidDetailPage';
import { AndroidCheckoutPage } from '../../features/android/AndroidCheckoutPage';
import { AndroidProfilePage } from '../../features/android/AndroidProfilePage';
import { MobileOrdersPage } from './MobileOrdersPage';

import { Smartphone, Maximize2, Minimize2, Sparkles, ExternalLink } from 'lucide-react';

export const MobileFrame: React.FC = () => {
  const { appMode, mpPage, androidPage, setMpPage, setAndroidPage } = useMall();
  const [isFrameMode, setIsFrameMode] = useState(true);

  const renderMiniProgramPage = () => {
    switch (mpPage) {
      case 'home':
        return <MPHomePage />;
      case 'category':
        return <MPCategoryPage />;
      case 'detail':
        return <MPDetailPage />;
      case 'cart':
        return <MPCartPage />;
      case 'orders':
        return <MobileOrdersPage mode="mini-program" />;
      case 'profile':
        return <MPProfilePage />;
      default:
        return <MPHomePage />;
    }
  };

  const renderAndroidPage = () => {
    switch (androidPage) {
      case 'home':
        return <AndroidHomePage />;
      case 'search':
        return <AndroidSearchPage />;
      case 'detail':
        return <AndroidDetailPage />;
      case 'checkout':
        return <AndroidCheckoutPage />;
      case 'orders':
        return <MobileOrdersPage mode="android-app" />;
      case 'profile':
        return <AndroidProfilePage />;
      default:
        return <AndroidHomePage />;
    }
  };

  const isMP = appMode === 'mini-program';

  return (
    <div className="min-h-screen bg-[#111827] text-white flex flex-col font-sans selection:bg-[var(--sw-brand)] selection:text-white">
      {/* 顶部多端切换导览条 */}
      <MobileTopBarSwitcher />

      {/* Frame / Display Control Toolbar */}
      <div className="bg-gray-900/90 border-b border-gray-800 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isMP ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
            {isMP ? '微信小程序 独立高保真入口' : 'Android App Material 3 原生体验入口'}
          </span>
          <span className="text-gray-400">
            设计尺寸: <span className="font-mono text-white font-bold">{isMP ? '390 × 844 px' : '412 × 915 px'}</span>
          </span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <button onClick={() => setIsFrameMode(!isFrameMode)} className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer font-medium">
            {isFrameMode ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                <span>全屏全宽度视图</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                <span>真机外框画布视图</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-6 bg-gradient-to-b from-gray-950 to-gray-900 overflow-x-hidden">
        {isFrameMode ? (
          /* Device Frame Wrapper */
          <div className="relative group transition-all duration-300">
            {/* Phone Shell Border */}
            <div
              style={{
                width: isMP ? '390px' : '412px',
                height: isMP ? '844px' : '915px',
              }}
              className="bg-gray-950 rounded-[48px] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border-[8px] border-gray-800 ring-1 ring-white/10 relative flex flex-col overflow-hidden max-w-[95vw] max-h-[88vh] sm:max-h-[92vh]"
            >
              {/* Top Notch / Camera Cutout */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-50 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-gray-900 border border-gray-800" />
              </div>

              {/* Inner Screen Scroll Viewport */}
              <div className="w-full h-full bg-[#F5F7FA] rounded-[36px] overflow-hidden flex flex-col relative shadow-inner">{isMP ? renderMiniProgramPage() : renderAndroidPage()}</div>

              {/* Bottom Home Indicator Line */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-600 rounded-full opacity-80" />
            </div>
          </div>
        ) : (
          /* Fullscreen Responsive Mode */
          <div className="w-full max-w-[430px] min-h-[85vh] bg-[#F5F7FA] text-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-800 flex flex-col">{isMP ? renderMiniProgramPage() : renderAndroidPage()}</div>
        )}
      </div>

      {/* Global Interface Pending Modal */}
      <PendingInterfaceModal />
    </div>
  );
};
