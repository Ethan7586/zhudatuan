import React, { useState } from 'react';
import { useMall, TabletPage, TabletOrientation } from '../../context/MallContext';
import { MobileTopBarSwitcher } from './MobileTopBarSwitcher';
import { PendingInterfaceModal } from './PendingInterfaceModal';
import { TabletNavRail } from './TabletNavRail';

import { TabletHomePage } from '../../features/tablet/TabletHomePage';
import { TabletCategoryPage } from '../../features/tablet/TabletCategoryPage';
import { TabletDetailPage } from '../../features/tablet/TabletDetailPage';
import { TabletCartCheckoutPage } from '../../features/tablet/TabletCartCheckoutPage';
import { TabletOrdersPage } from '../../features/tablet/TabletOrdersPage';

import { Tablet, Maximize2, Minimize2, RotateCw, Sparkles, Monitor } from 'lucide-react';

export const TabletFrame: React.FC = () => {
  const { tabletPage, tabletOrientation, setTabletOrientation } = useMall();

  const [deviceModel, setDeviceModel] = useState<'android_1280_800' | 'ipad_1180_820'>('android_1280_800');
  const [isFrameMode, setIsFrameMode] = useState(true);

  // Dimension calculations
  const isLandscape = tabletOrientation === 'landscape';
  let width = '1280px';
  let height = '800px';

  if (deviceModel === 'android_1280_800') {
    width = isLandscape ? '1280px' : '800px';
    height = isLandscape ? '800px' : '1280px';
  } else {
    width = isLandscape ? '1180px' : '820px';
    height = isLandscape ? '820px' : '1180px';
  }

  const renderTabletContent = () => {
    switch (tabletPage) {
      case 'home':
        return <TabletHomePage />;
      case 'category':
        return <TabletCategoryPage />;
      case 'detail':
        return <TabletDetailPage />;
      case 'cart':
        return <TabletCartCheckoutPage />;
      case 'orders':
        return <TabletOrdersPage />;
      case 'profile':
        return <TabletHomePage />; // or home with right profile focused
      default:
        return <TabletHomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col font-sans selection:bg-[var(--sw-brand)] selection:text-white">
      {/* 顶部多端切换导览条 */}
      <MobileTopBarSwitcher />

      {/* Tablet Control Toolbar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-lg font-bold">
            <Tablet className="w-3.5 h-3.5" />
            <span>平板端 (Tablet Commerce UI)</span>
          </div>

          <div className="text-gray-400 text-[11px] flex items-center gap-2">
            <span>设计规格:</span>
            <button
              onClick={() => setDeviceModel('android_1280_800')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${deviceModel === 'android_1280_800' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              Android平板 ({isLandscape ? '1280×800' : '800×1280'})
            </button>
            <button
              onClick={() => setDeviceModel('ipad_1180_820')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${deviceModel === 'ipad_1180_820' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              iPad 参照 ({isLandscape ? '1180×820' : '820×1180'})
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Orientation Toggle Button */}
          <button
            onClick={() => setTabletOrientation(isLandscape ? 'portrait' : 'landscape')}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer font-bold text-xs"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>切换为{isLandscape ? '竖屏 (Portrait)' : '横屏 (Landscape)'}</span>
          </button>

          {/* Canvas Mode Toggle */}
          <button onClick={() => setIsFrameMode(!isFrameMode)} className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer font-medium">
            {isFrameMode ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                <span>全屏全宽视图</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                <span>平板真机外框</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Tablet Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-6 bg-gradient-to-b from-gray-950 to-gray-900 overflow-x-hidden">
        {isFrameMode ? (
          /* Tablet Hardware Frame Wrapper */
          <div className="relative group transition-all duration-300">
            <div
              style={{ width, height }}
              className="bg-gray-950 rounded-[40px] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border-[10px] border-gray-800 ring-1 ring-white/10 relative flex flex-col overflow-hidden max-w-[96vw] max-h-[88vh] sm:max-h-[92vh]"
            >
              {/* Front Camera Dot */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rounded-full border border-gray-800 z-50" />

              {/* Tablet Inner Viewport Layout */}
              <div className="w-full h-full bg-[#F5F7FA] rounded-[28px] overflow-hidden flex relative shadow-inner">
                {isLandscape ? (
                  /* Landscape Layout: Left Rail + Right Content */
                  <div className="w-full h-full flex overflow-hidden">
                    <TabletNavRail />
                    <div className="flex-1 h-full overflow-hidden">{renderTabletContent()}</div>
                  </div>
                ) : (
                  /* Portrait Layout: Content + Bottom Nav Rail */
                  <div className="w-full h-full flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-hidden">{renderTabletContent()}</div>
                    <TabletNavRail />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Responsive Full Window Mode */
          <div className="w-full max-w-[1280px] min-h-[85vh] bg-[#F5F7FA] text-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-800 flex">
            {isLandscape ? (
              <div className="w-full h-full flex overflow-hidden min-h-[750px]">
                <TabletNavRail />
                <div className="flex-1 h-full overflow-hidden">{renderTabletContent()}</div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col overflow-hidden min-h-[900px]">
                <div className="flex-1 overflow-hidden">{renderTabletContent()}</div>
                <TabletNavRail />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global Interface Pending Modal */}
      <PendingInterfaceModal />
    </div>
  );
};
