import { useEffect, useState } from 'react';
import type { AndroidAppPage, AppMode, AppModeSwitchOptions, LaptopPage, MiniProgramPage, PageRoute, PendingFeatureInfo, RouteParams, TabletOrientation, TabletPage, ViewportMode } from './MallContext.types';

export function modeFromPath(path: string): AppMode {
  if (path.startsWith('/desktop-1920')) return 'pc';
  if (path.startsWith('/mini-program')) return 'mini-program';
  if (path.startsWith('/android-app')) return 'android-app';
  if (path.startsWith('/tablet-app')) return 'tablet-app';
  if (path.startsWith('/laptop-web')) return 'laptop-web';
  return 'pc';
}

export function laptopPageFromPath(path: string): LaptopPage {
  return path.startsWith('/desktop-1920') ? 'home-1440' : 'home-1366';
}

function pageFromLocation(): PageRoute {
  if (window.location.pathname.startsWith('/architecture')) return 'architecture';
  const hashPage = window.location.hash.replace('#/', '').split('?')[0];
  return (hashPage || 'home') as PageRoute;
}

export function useDeviceNavigation(initialPath = '/') {
  const [appMode, setAppModeState] = useState<AppMode>(() => modeFromPath(initialPath));
  const [viewportMode, setViewportMode] = useState<ViewportMode>('auto');
  const [mpPage, setMpPageState] = useState<MiniProgramPage>('home');
  const [androidPage, setAndroidPageState] = useState<AndroidAppPage>('home');
  const [tabletPage, setTabletPageState] = useState<TabletPage>('home');
  const [tabletOrientation, setTabletOrientation] = useState<TabletOrientation>('landscape');
  const [laptopPage, setLaptopPageState] = useState<LaptopPage>(() => laptopPageFromPath(initialPath));
  const [mobileProductId, setMobileProductId] = useState('p_101');
  const [pendingFeature, setPendingFeature] = useState<PendingFeatureInfo>({
    isOpen: false,
    featureName: '',
  });
  const [currentPage, setCurrentPage] = useState<PageRoute>('home');
  const [routeParams, setRouteParams] = useState<RouteParams>({});

  const setAppMode = (mode: AppMode, options: AppModeSwitchOptions = {}) => {
    setAppModeState(mode);
    if (options.preservePath) return;
    const paths: Record<AppMode, string> = {
      pc: '/',
      'mini-program': '/mini-program',
      'android-app': '/android-app',
      'tablet-app': '/tablet-app',
      'laptop-web': '/laptop-web',
    };
    if (window.location.pathname !== paths[mode]) {
      window.history.pushState({}, '', paths[mode]);
    }
  };

  const scrollTop = (behavior: ScrollBehavior = 'smooth') => window.scrollTo({ top: 0, behavior });
  const setMpPage = (page: MiniProgramPage, productId?: string) => {
    setMpPageState(page);
    if (productId) setMobileProductId(productId);
  };
  const setAndroidPage = (page: AndroidAppPage, productId?: string) => {
    setAndroidPageState(page);
    if (productId) setMobileProductId(productId);
    scrollTop();
  };
  const setTabletPage = (page: TabletPage, productId?: string) => {
    setTabletPageState(page);
    if (productId) setMobileProductId(productId);
    scrollTop();
  };
  const setLaptopPage = (page: LaptopPage, productId?: string) => {
    setLaptopPageState(page);
    if (productId) setMobileProductId(productId);
    scrollTop();
  };
  const triggerPendingFeature = (featureName: string, desc?: string) => setPendingFeature({ isOpen: true, featureName, desc });
  const closePendingFeatureModal = () => setPendingFeature((previous) => ({ ...previous, isOpen: false }));

  const navigateTo = (page: PageRoute, params: RouteParams = {}) => {
    setCurrentPage(page);
    setRouteParams(params);
    scrollTop('auto');
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) query.set(key, String(value));
    });
    window.location.hash = `#/${page}${query.size ? `?${query}` : ''}`;
  };

  useEffect(() => {
    const handlePopState = () => {
      setAppModeState(modeFromPath(window.location.pathname));
      setCurrentPage(pageFromLocation());
    };
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      if (!hash) return;
      const [page, rawQuery = ''] = hash.split('?');
      const params = Object.fromEntries(new URLSearchParams(rawQuery)) as RouteParams;
      setCurrentPage(page as PageRoute);
      setRouteParams(params);
    };
    handlePopState();
    handleHashChange();
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return {
    appMode,
    setAppMode,
    viewportMode,
    setViewportMode,
    mpPage,
    setMpPage,
    androidPage,
    setAndroidPage,
    tabletPage,
    setTabletPage,
    tabletOrientation,
    setTabletOrientation,
    laptopPage,
    setLaptopPage,
    mobileProductId,
    setMobileProductId,
    pendingFeature,
    triggerPendingFeature,
    closePendingFeatureModal,
    currentPage,
    routeParams,
    navigateTo,
  };
}
