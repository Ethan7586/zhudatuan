import React from 'react';
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useMall } from '../../context/MallContext';
import type { ToastMessage } from '../../context/MallContext.types';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useMall();
  const cartToast = [...toasts].reverse().find((toast) => toast.channel === 'cart');
  const regularToasts = toasts.filter((toast) => toast.channel !== 'cart');

  if (!cartToast && regularToasts.length === 0) return null;

  return (
    <>
      {regularToasts.length > 0 ? (
        <div className="fixed left-3 right-3 top-14 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col gap-2.5 pointer-events-none sm:left-auto sm:right-5 sm:top-5 sm:max-w-sm">
          {regularToasts.map((toast) => (
            <div key={toast.id} className={`pointer-events-auto flex items-center justify-between gap-3 rounded-md border bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-lg transition-all duration-200 motion-reduce:transition-none ${toastBorder(toast.type)}`}>
              <ToastContent toast={toast} />
              <button type="button" aria-label="关闭提示" onClick={() => removeToast(toast.id)} className="rounded p-0.5 text-gray-400 transition-colors hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {cartToast ? (
        <div
          data-cart-toast="true"
          role="status"
          className="pointer-events-none fixed bottom-[66px] left-1/2 z-50 flex h-10 max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center rounded-full border border-blue-100/90 bg-white px-4 text-xs font-semibold text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.14)] transition-[opacity,transform] duration-150 motion-reduce:transition-none"
        >
          <ToastContent toast={cartToast} />
        </div>
      ) : null}
    </>
  );
};

function ToastContent({ toast }: Readonly<{ toast: ToastMessage }>) {
  const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? XCircle : toast.type === 'warning' ? AlertCircle : Info;
  const color = toast.type === 'success' ? 'text-emerald-600' : toast.type === 'error' ? 'text-rose-600' : toast.type === 'warning' ? 'text-amber-600' : 'text-[var(--sw-brand)]';
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className={`h-4 w-4 flex-none ${color}`} />
      <span className="truncate leading-none">{toast.text}</span>
    </div>
  );
}

function toastBorder(type: ToastMessage['type']): string {
  if (type === 'success') return 'border-green-200 shadow-green-900/5';
  if (type === 'error') return 'border-red-200 shadow-red-900/5';
  if (type === 'warning') return 'border-amber-200 shadow-amber-900/5';
  return 'border-blue-200 shadow-blue-900/5';
}
