import { useCallback, useState } from 'react';
export interface ToastMessage {
  readonly id: string;
  readonly type: 'success' | 'info' | 'error' | 'warning';
  readonly text: string;
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const removeToast = useCallback((id: string) => setToasts((previous) => previous.filter((toast) => toast.id !== id)), []);
  const showToast = useCallback(
    (text: string, type: ToastMessage['type'] = 'success') => {
      const id = `toast:${crypto.randomUUID()}`;
      setToasts((previous) => [...previous, { id, text, type }]);
      setTimeout(() => removeToast(id), 3500);
    },
    [removeToast]
  );

  return { toasts, showToast, removeToast };
}
