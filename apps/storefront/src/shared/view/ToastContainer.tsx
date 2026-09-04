/**
 * 智慧翼企业福利商城 - 全局 Toast 提示组件
 * 技术服务方：雍彻科技
 */

import React from 'react';
import type { ToastMessage } from './ToastState';
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';

export const ToastContainer: React.FC<{ readonly toasts: readonly ToastMessage[]; readonly removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
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
                ? 'bg-surface text-content border-success shadow-success-strong/5'
                : isError
                  ? 'bg-surface text-content border-danger shadow-danger-strong/5'
                  : isWarning
                    ? 'bg-surface text-content border-warning shadow-warning-strong/5'
                    : 'bg-surface text-content border-brand shadow-brand-dark/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-[var(--sw-success)] flex-shrink-0" />}
              {isError && <XCircle className="w-5 h-5 text-[var(--sw-danger)] flex-shrink-0" />}
              {isWarning && <AlertCircle className="w-5 h-5 text-[var(--sw-warning)] flex-shrink-0" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-[var(--sw-brand)] flex-shrink-0" />}
              <span className="leading-snug">{toast.text}</span>
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-muted hover:text-secondary transition-colors p-0.5 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
