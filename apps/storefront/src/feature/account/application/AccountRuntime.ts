import { useNavigate } from 'react-router';
import { pathForFeature } from '../../../shared/manifest/StorefrontRoute';
import { useCatalogState } from '../../catalog/public/index';
import { useOrderState } from '../../order/public/index';
import { useAccountIdentity } from './AccountIdentity';

export function useAccountRuntime() {
  const navigate = useNavigate();
  const identity = useAccountIdentity();
  const catalog = useCatalogState();
  const order = useOrderState(identity.currentMall);
  return Object.freeze({
    ...identity,
    presentationOrders: order.presentationOrders,
    presentationProducts: catalog.presentationProducts,
    openFeature: (name: string) => {
      void navigate(pathForFeature(name));
    },
  });
}
