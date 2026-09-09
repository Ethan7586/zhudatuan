import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastMessage, ToastOptions } from './MallContext.types';

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const removeToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);
  const showToast = useCallback(
    (text: string, type: ToastMessage['type'] = 'success', options: ToastOptions = {}) => {
      const channel = options.channel ?? 'default';
      const id = channel === 'cart' ? 'toast_cart' : `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      const currentTimer = timers.current.get(id);
      if (currentTimer) clearTimeout(currentTimer);
      setToasts((previous) => [
        ...previous.filter((toast) => toast.id !== id),
        { channel, id, text, type },
      ]);
      timers.current.set(id, setTimeout(() => removeToast(id), options.durationMs ?? (channel === 'cart' ? 1_200 : 3_500)));
    },
    [removeToast]
  );

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
  }, []);

  return { toasts, showToast, removeToast };
}
