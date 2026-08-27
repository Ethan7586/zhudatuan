import { useCallback, useState } from 'react';
import type { ToastMessage } from './MallContext.types';

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const removeToast = useCallback((id: string) => setToasts((previous) => previous.filter((toast) => toast.id !== id)), []);
  const showToast = useCallback(
    (text: string, type: ToastMessage['type'] = 'success') => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      setToasts((previous) => [...previous, { id, text, type }]);
      setTimeout(() => removeToast(id), 3500);
    },
    [removeToast]
  );

  return { toasts, showToast, removeToast };
}
