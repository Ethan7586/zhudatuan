/**
 * 智慧翼企业福利商城 - 全局 Toast 提示组件
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { useMall } from '../../context/MallContext';
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useMall();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-md shadow-lg border text-sm font-medium transition-all duration-200 animate-in slide-in-from-top-2 ${
              isSuccess
                ? 'bg-white text-gray-900 border-green-200 shadow-green-900/5'
                : isError
                  ? 'bg-white text-gray-900 border-red-200 shadow-red-900/5'
                  : isWarning
                    ? 'bg-white text-gray-900 border-amber-200 shadow-amber-900/5'
                    : 'bg-white text-gray-900 border-blue-200 shadow-blue-900/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-[#18A058] flex-shrink-0" />}
              {isError && <XCircle className="w-5 h-5 text-[#E5484D] flex-shrink-0" />}
              {isWarning && <AlertCircle className="w-5 h-5 text-[#FF7A00] flex-shrink-0" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-[var(--sw-brand)] flex-shrink-0" />}
              <span className="leading-snug">{toast.text}</span>
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
