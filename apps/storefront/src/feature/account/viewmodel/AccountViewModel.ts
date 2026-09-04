import { useNavigate, useSearchParams } from 'react-router';
import { routePath } from '../../../generated/RouteBinding';
import { pathForFeature } from '../../../shared/navigation/Route';
import { useCatalogState } from '../../catalog';
import { useOrderState } from '../../order';
import { useAccountIdentity } from './AccountIdentityViewModel';

export function useAccountViewModel() {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
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
    section: search.get('section'),
    actions: Object.freeze({
      profile: () => {
        const next = new URLSearchParams(search);
        next.delete('section');
        setSearch(next);
      },
      addresses: () => {
        const next = new URLSearchParams(search);
        next.set('section', 'addresses');
        setSearch(next);
      },
      favorites: () => {
        const next = new URLSearchParams(search);
        next.set('section', 'favorites');
        setSearch(next);
      },
      openProduct: (id: string) => void navigate(routePath('storeproduct', { productId: id })),
    }),
  });
}
