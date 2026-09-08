import { useEffect, useLayoutEffect } from 'react';

const positions = new Map<string, number>();
const maximumEntries = 100;

/** Restores the scroll offset for one browser history entry without persisting user data. */
export function RouteScroll({ entry }: Readonly<{ entry: string }>) {
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: positions.get(entry) ?? 0, behavior: 'auto' }));
    return () => {
      window.cancelAnimationFrame(frame);
      positions.delete(entry);
      positions.set(entry, window.scrollY);
      while (positions.size > maximumEntries) positions.delete(positions.keys().next().value!);
    };
  }, [entry]);

  return null;
}
