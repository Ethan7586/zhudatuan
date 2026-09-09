import { lazy, useEffect, useRef, useSyncExternalStore, type ComponentType, type LazyExoticComponent } from 'react';
import type { FeedbackMessage, FeedbackStore } from './FeedbackStore';

type ComponentPropsOf<Value> = Value extends ComponentType<infer Props> ? Props : never;

export function lazyNamed<Module extends object, Name extends keyof Module>(load: () => Promise<Module>, name: Name): LazyExoticComponent<ComponentType<ComponentPropsOf<Module[Name]>>> {
  return lazy(async () => ({
    default: (await load())[name] as ComponentType<ComponentPropsOf<Module[Name]>>,
  }));
}

export function useFeedbackStore<Message extends FeedbackMessage>(createStore: () => FeedbackStore<Message>): Readonly<{ messages: readonly Message[]; store: FeedbackStore<Message> }> {
  const storeRef = useRef<FeedbackStore<Message> | null>(null);
  if (storeRef.current === null) storeRef.current = createStore();
  const store = storeRef.current;
  const messages = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => () => store.dispose(), [store]);
  return { messages, store };
}
