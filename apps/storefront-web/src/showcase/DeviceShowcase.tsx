'use client';

import React from 'react';
import { MallProvider, useMall } from '../context/MallContext';
import { mallService } from '../services/mallService';
import type { StorefrontWebSurface } from '../components/laptop/StorefrontWebStandard';

const MobileFrame = React.lazy(() => import('../components/mobile/MobileFrame').then(({ MobileFrame }) => ({ default: MobileFrame })));
const TabletFrame = React.lazy(() => import('../components/mobile/TabletFrame').then(({ TabletFrame }) => ({ default: TabletFrame })));
const StorefrontWebFrame = React.lazy(() => import('../components/laptop/LaptopFrame').then(({ StorefrontWebFrame }) => ({ default: StorefrontWebFrame })));

const SHOWCASE_PATH_PREFIXES = ['/desktop-1920', '/mini-program', '/android-app', '/tablet-app', '/laptop-web'] as const;

export function isSupportedShowcasePath(path: string) {
  return SHOWCASE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export type ShowcaseSurface =
  | { family: 'storefront-web'; surface: StorefrontWebSurface }
  | { family: 'mini-program' | 'android-app' | 'tablet-app'; surface: null };

export function resolveShowcaseSurface(path: string): ShowcaseSurface | null {
  if (!isSupportedShowcasePath(path)) return null;
  if (path === '/desktop-1920' || path.startsWith('/desktop-1920/')) return { family: 'storefront-web', surface: 'desktop-1920' };
  if (path === '/laptop-web' || path.startsWith('/laptop-web/')) return { family: 'storefront-web', surface: 'laptop' };
  if (path === '/mini-program' || path.startsWith('/mini-program/')) return { family: 'mini-program', surface: null };
  if (path === '/android-app' || path.startsWith('/android-app/')) return { family: 'android-app', surface: null };
  return { family: 'tablet-app', surface: null };
}

function DeviceShowcaseContent({ isSupportedPath }: { isSupportedPath: boolean }) {
  const { appMode } = useMall();
  if (!isSupportedPath) return <div className="min-h-screen bg-slate-950 text-white grid place-items-center">该展示入口不存在</div>;
  if (appMode === 'pc') return <StorefrontWebFrame surface="desktop-1920" />;
  if (appMode === 'mini-program' || appMode === 'android-app') return <MobileFrame />;
  if (appMode === 'tablet-app') return <TabletFrame />;
  if (appMode === 'laptop-web') return <StorefrontWebFrame surface="laptop" />;
  return <div className="min-h-screen bg-slate-950 text-white grid place-items-center">该展示入口不存在</div>;
}

export function DeviceShowcase({ initialPath }: { initialPath: string }) {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // The legacy showcase restores mock user/cart state from localStorage.
  // Mount it only after hydration so persisted browser data cannot diverge
  // from the server's default mock snapshot.
  if (!isMounted) return <div className="min-h-screen bg-slate-950" aria-busy="true" aria-label="正在载入多端展示" />;

  return (
    <MallProvider showcaseService={mallService} initialPath={initialPath}>
      <React.Suspense fallback={<div className="min-h-screen bg-slate-950" aria-busy="true" />}>
        <DeviceShowcaseContent isSupportedPath={isSupportedShowcasePath(initialPath)} />
      </React.Suspense>
    </MallProvider>
  );
}
