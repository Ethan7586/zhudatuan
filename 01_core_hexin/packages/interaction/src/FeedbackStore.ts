export interface FeedbackMessage {
  readonly id: string;
  readonly channel: string;
}

export interface FeedbackPublishOptions {
  readonly durationMs?: number;
  readonly replaceChannel?: boolean;
}

export interface FeedbackStore<Message extends FeedbackMessage> {
  readonly publish: (message: Message, options?: FeedbackPublishOptions) => void;
  readonly remove: (id: string) => void;
  readonly getSnapshot: () => readonly Message[];
  readonly subscribe: (listener: () => void) => () => void;
  readonly dispose: () => void;
}

export function createFeedbackStore<Message extends FeedbackMessage>(): FeedbackStore<Message> {
  const listeners = new Set<() => void>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let snapshot: readonly Message[] = [];
  let disposed = false;

  const notify = () => {
    for (const listener of listeners) listener();
  };
  const cancelTimer = (id: string) => {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
  };
  const remove = (id: string) => {
    if (disposed) return;
    cancelTimer(id);
    const next = snapshot.filter((message) => message.id !== id);
    if (next.length === snapshot.length) return;
    snapshot = next;
    notify();
  };

  return {
    publish(message, options = {}) {
      if (disposed) return;
      const replaceChannel = options.replaceChannel ?? true;
      const retained = snapshot.filter((current) => {
        const replace = current.id === message.id || (replaceChannel && current.channel === message.channel);
        if (replace) cancelTimer(current.id);
        return !replace;
      });
      snapshot = [...retained, message];
      const durationMs = options.durationMs;
      if (durationMs && durationMs > 0) {
        timers.set(
          message.id,
          setTimeout(() => remove(message.id), durationMs)
        );
      }
      notify();
    },
    remove,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) return;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      listeners.clear();
      snapshot = [];
      disposed = true;
    },
  };
}
