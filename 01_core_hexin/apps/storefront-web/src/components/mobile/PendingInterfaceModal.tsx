import React from 'react';
import { useMall } from '../../context/MallContext';
import { AlertTriangle, X, ShieldAlert, Cpu } from 'lucide-react';

export const PendingInterfaceModal: React.FC = () => {
  const { pendingFeature, closePendingFeatureModal } = useMall();

  if (!pendingFeature.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 font-sans text-gray-800 relative">
        <button onClick={closePendingFeatureModal} className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-3 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-xs">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>

          <div>
            <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">原生 SDK 接口扩展</span>
            <h3 className="text-base font-black text-gray-900">{pendingFeature.featureName} · 接口待接入</h3>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-200/80">
            {pendingFeature.desc ||
              `当前“${pendingFeature.featureName}”为客户端高保真 UI 与交互状态示例。该功能需在打包发布至实际运行终端后，接入对应平台原生 SDK API（如微信开放平台支付/授权、Android Biometric 生物识别、极光 Push 推送）。`}
          </p>

          <div className="w-full pt-2 flex items-center gap-2">
            <button onClick={closePendingFeatureModal} className="w-full bg-[var(--sw-brand)] hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer">
              已知晓 (高保真交互预览)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
