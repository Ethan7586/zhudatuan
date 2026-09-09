import { useLocation, useNavigate } from 'react-router';
import { useSession } from '../entity/session/viewmodel/SessionContext';
import { useAccountIdentity } from '../feature/account';
import { useCartCommand } from '../feature/cart';
import { ROUTES } from '../generated/RouteBinding';
import { shellNavigation } from './ShellNavigation';

export function useShellViewModel() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const identity = useAccountIdentity();
  const cart = useCartCommand();
  const composition = shellNavigation(session.navigation, session.experience);
  return Object.freeze({
    brand: Object.freeze({
      name: identity.currentMall.mallName,
      enterprise: identity.currentMall.enterpriseName,
      badge: identity.currentMall.badge,
    }),
    navigation: composition,
    pathname: location.pathname,
    cartCount: (cart.cart?.items ?? []).reduce((total, item) => total + Number(item.quantity), 0),
    account: Object.freeze({
      authenticated: session.status === 'authenticated',
      name: identity.profileState === 'ready' ? identity.user.name : identity.profileState === 'failed' ? '账户暂不可用' : '账户加载中',
      currentMall: identity.currentMall,
      malls: identity.malls,
    }),
    toasts: session.toasts,
    removeToast: session.removeToast,
    actions: Object.freeze({
      navigate: (path: string) => void navigate(path),
      home: () => void navigate(ROUTES.storehome),
      catalog: () => void navigate(ROUTES.storecatalog),
      search: (value: string) => void navigate(value.trim() ? `${ROUTES.storecatalog}?q=${encodeURIComponent(value.trim().slice(0, 200))}` : ROUTES.storecatalog),
      switchMall: identity.switchMall,
      logout: identity.logout,
    }),
  });
}
