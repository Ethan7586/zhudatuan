import { createFeedbackStore } from '@shop/interaction';
import { useFeedbackStore } from '@shop/interaction/react';
import type { ToastMessage, ToastOptions } from './MallContext.types';

type StoredToastMessage = Omit<ToastMessage, 'channel'> & Readonly<{ channel: NonNullable<ToastMessage['channel']> }>;

export function useToasts() {
  const { messages: toasts, store } = useFeedbackStore<StoredToastMessage>(() => createFeedbackStore<StoredToastMessage>());
  return {
    toasts,
    removeToast: store.remove,
    showToast(text: string, type: ToastMessage['type'] = 'success', options: ToastOptions = {}) {
      const channel = options.channel ?? 'default';
      store.publish(
        { channel, id: channel, text, type },
        { durationMs: options.durationMs ?? (channel === 'cart' ? 1_200 : 3_500) },
      );
    },
  };
}
