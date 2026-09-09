import { useNavigate, useSearchParams } from 'react-router';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { routePath, ROUTES } from '../../../generated/RouteBinding';
import { pathForFeature } from '../../../shared/navigation/Route';
import { useAccountIdentity } from '../../account';
import { useOrderState } from './OrderState';
import { orderFilter, type OrderFilter } from '../model/OrderFilter';

export function useOrderViewModel() {
  const navigate = useNavigate();
  const session = useSession();
  const identity = useAccountIdentity();
  const [search, setSearch] = useSearchParams();
  const order = useOrderState(identity.currentMall);
  const status = orderFilter(search.get('status'));
  const visibleOrders = order.orders.filter((item) => status === 'all' || item.status === status);
  const filter = (value: OrderFilter) => {
    const next = new URLSearchParams(search);
    if (value === 'all') next.delete('status');
    else next.set('status', value);
    setSearch(next);
  };
  return Object.freeze({
    user: identity.user,
    ...order,
    openFeature: (name: string) => {
      void navigate(pathForFeature(name));
    },
    showToast: session.showToast,
    status,
    visibleOrders,
    actions: Object.freeze({
      filter,
      open: (id: string) => void navigate(routePath('storeorder', { orderId: id })),
      aftersale: (id: string) => void navigate(routePath('storeaftersale', { orderId: id })),
      invoices: () => void navigate(`${ROUTES.storeorders}?view=invoices`),
      aftersales: () => filter('after_sale'),
    }),
  });
}
