import { useSyncExternalStore } from 'react';

export type ViewportKind = 'mobile' | 'tablet' | 'desktop';

export function useViewportKind(): ViewportKind {
  return useSyncExternalStore(subscribe, snapshot, () => 'desktop');
}

function snapshot(): ViewportKind {
  if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1023px)').matches) return 'tablet';
  return 'desktop';
}

function subscribe(notify: () => void): () => void {
  const mobile = window.matchMedia('(max-width: 767px)');
  const tablet = window.matchMedia('(max-width: 1023px)');
  mobile.addEventListener('change', notify);
  tablet.addEventListener('change', notify);
  return () => {
    mobile.removeEventListener('change', notify);
    tablet.removeEventListener('change', notify);
  };
}
