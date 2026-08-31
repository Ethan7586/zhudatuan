import { useNavigate } from 'react-router';
import { useSession } from '../../../shared/runtime/SessionContext';
import { pathForFeature, pathForRoute } from '../../../shared/manifest/StorefrontRoute';
import { useAccountIdentity } from '../../account/public/index';
import { useOrderState } from './OrderState';

export function useOrderRuntime() {
  const navigate = useNavigate();
  const session = useSession();
  const identity = useAccountIdentity();
  const order = useOrderState(identity.currentMall);
  return Object.freeze({
    user: identity.user,
    ...order,
    openFeature: (name: string) => {
      void navigate(pathForFeature(name));
    },
    navigateTo: (route: Parameters<typeof pathForRoute>[0], params?: Readonly<Record<string, unknown>>) => {
      void navigate(pathForRoute(route, params));
    },
    showToast: session.showToast,
  });
}
