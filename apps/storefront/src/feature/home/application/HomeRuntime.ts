import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../../shared/runtime/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import { pathForFeature, pathForPage } from '../../../shared/manifest/StorefrontRoute';
import { useAccountIdentity } from '../../account/public/index';
import { useCartCommand } from '../../cart/public/index';
import { useCatalogState } from '../../catalog/public/index';
import { useOrderState } from '../../order/public/index';
import { HomeGateway } from '../infrastructure/HomeGateway';
import { ReadHome } from './ReadHome';

export function useHomeRuntime() {
  const session = useSession();
  const navigate = useNavigate();
  const identity = useAccountIdentity();
  const catalog = useCatalogState();
  const cart = useCartCommand();
  const order = useOrderState(identity.currentMall);
  const reader = useRef(new ReadHome());
  const bootstrap = useQuery({ queryKey: StorefrontQuery.bootstrap(), queryFn: ({ signal }) => HomeGateway.read(signal) });
  return Object.freeze({
    user: identity.user,
    currentMall: identity.currentMall,
    presentationProducts: catalog.presentationProducts,
    presentationCategories: catalog.presentationCategories,
    catalogState: catalog.state,
    presentationOrders: order.presentationOrders,
    addToCart: (product: Parameters<typeof cart.add>[0], quantity: Parameters<typeof cart.add>[1] = 1) => {
      void cart.add(product, quantity);
    },
    homeExperience: reader.current.execute(bootstrap.data),
    setLaptopPage: (page: Parameters<typeof pathForPage>[0]) => {
      void navigate(pathForPage(page));
    },
    showToast: session.showToast,
    openFeature: (name: string) => {
      void navigate(pathForFeature(name));
    },
  });
}
