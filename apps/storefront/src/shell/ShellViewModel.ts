import { useNavigate } from 'react-router';
import { useSession } from '../entity/session/viewmodel/SessionContext';
import { useAccountIdentity } from '../feature/account/public';
import { useCartCommand } from '../feature/cart/public';
import { pathForFeature } from '../shared/navigation/Route';

export function useShellViewModel() {
  const navigate = useNavigate();
  const session = useSession();
  const identity = useAccountIdentity();
  const cart = useCartCommand();
  return Object.freeze({
    navigation: session.navigation,
    cartCount: (cart.cart?.items ?? []).reduce((total, item) => total + Number(item.quantity), 0),
    mall: identity.currentMall,
    malls: identity.malls,
    user: identity.user,
    toasts: session.toasts,
    removeToast: session.removeToast,
    actions: Object.freeze({
      navigate: (path: string) => void navigate(path),
      search: (value: string) => void navigate(value.trim() ? `/products?q=${encodeURIComponent(value.trim().slice(0, 200))}` : '/products'),
      feature: (name: string) => void navigate(pathForFeature(name)),
      switchMall: identity.switchMall,
      logout: identity.logout,
    }),
  });
}
