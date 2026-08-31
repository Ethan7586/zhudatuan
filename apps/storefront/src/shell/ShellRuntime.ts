import type { SetStateAction } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../shared/runtime/SessionContext';
import { pathForFeature, pathForPage, pathForRoute, type LaptopPage } from '../shared/manifest/StorefrontRoute';
import { useRoutePage } from '../route/Routes';
import { useAccountIdentity } from '../feature/account/public/index';
import { useCartCommand } from '../feature/cart/public/index';

export function useShellRuntime() {
  const session = useSession();
  const navigate = useNavigate();
  const page = useRoutePage();
  const identity = useAccountIdentity();
  const cart = useCartCommand();
  const setLaptopPage = (value: SetStateAction<LaptopPage>) => {
    const next = typeof value === 'function' ? value(page) : value;
    void navigate(pathForPage(next));
  };
  return Object.freeze({
    laptopPage: page,
    setLaptopPage,
    navigationNodes: session.navigation.map((item) =>
      Object.freeze({
        ...item,
        component: item.route === '/products' ? 'catalog' : item.route.slice(1) || 'home',
        disabled: false,
        children: Object.freeze([]),
      })
    ),
    cartCount: (cart.cart?.items ?? []).reduce((total, { quantity }) => total + Number(quantity), 0),
    currentMall: identity.currentMall,
    malls: identity.malls,
    switchMall: identity.switchMall,
    user: identity.user,
    logout: identity.logout,
    showToast: identity.showToast,
    openFeature: (name: string) => {
      void navigate(pathForFeature(name));
    },
    navigateTo: (route: Parameters<typeof pathForRoute>[0], params?: Readonly<Record<string, unknown>>) => {
      void navigate(pathForRoute(route, params));
    },
  });
}
