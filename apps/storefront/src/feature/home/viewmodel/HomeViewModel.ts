import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { routePath } from '../../../generated/RouteBinding';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import { pathForFeature, pathForPage } from '../../../shared/navigation/Route';
import { useAccountIdentity } from '../../account';
import { useCartCommand } from '../../cart';
import { useCatalogState } from '../../catalog';
import { useOrderState } from '../../order';
import { ReadHome } from '../application/ReadHome';
import { useDependencies } from '../../../app/DependencyContext';

export function useHomeViewModel() {
  const session = useSession();
  const dependencies = useDependencies();
  const navigate = useNavigate();
  const identity = useAccountIdentity();
  const catalog = useCatalogState();
  const cart = useCartCommand();
  const order = useOrderState(identity.currentMall);
  const reader = useRef(new ReadHome());
  const bootstrap = useQuery({ queryKey: StorefrontQuery.bootstrap(session.entry.handle), queryFn: ({ signal }) => dependencies.home.read(signal) });
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
    navigatePage: (page: Parameters<typeof pathForPage>[0]) => {
      void navigate(pathForPage(page));
    },
    showToast: session.showToast,
    openFeature: (name: string) => {
      void navigate(pathForFeature(name));
    },
    openProduct: (id: string) => void navigate(routePath('storeproduct', { productId: id })),
  });
}
