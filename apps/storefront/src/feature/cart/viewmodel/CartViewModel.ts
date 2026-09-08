import { useNavigate } from 'react-router';
import { ROUTES } from '../../../generated/RouteBinding';
import { useAccountIdentity } from '../../account';
import { useCatalogState } from '../../catalog';
import { projectCart } from './CartProjection';
import { useCartCommand } from './CartCommandViewModel';

export function useCartViewModel() {
  const navigate = useNavigate();
  const identity = useAccountIdentity();
  const command = useCartCommand();
  const listingIds = Object.freeze(command.cart?.items.map(({ listing }) => listing) ?? []);
  const catalog = useCatalogState({ listingIds }, command.cart !== undefined && listingIds.length > 0);
  const cartView = projectCart(command.cart, catalog.products);
  const selectedLines = cartView.lines.filter((item) => item.selected && item.validity.state === 'valid');
  const select = (items: ReadonlyArray<(typeof cartView.lines)[number]>, value: boolean) => command.batch(items.map((item) => ({ listingId: item.listingId, quantity: item.quantity, lineVersion: item.lineVersion, selected: value })));
  const navigateTo = (route: 'checkout') => {
    if (route === 'checkout') void navigate(ROUTES.storecheckout);
  };
  return Object.freeze({
    cart: cartView.lines,
    isLoading: command.state === 'loading',
    failed: command.state === 'error',
    user: identity.user,
    addresses: identity.addresses,
    toggleCartItemSelected: (id: string) => {
      const item = cartView.lines.find((candidate) => candidate.id === id);
      if (item) void command.change(item.listingId, item.quantity, item.lineVersion, !item.selected);
    },
    toggleSelectAllCart: (value: boolean) => void select(cartView.lines.filter((item) => item.selected !== value), value),
    updateCartQuantity: (id: string, quantity: number) => {
      const item = cartView.lines.find((candidate) => candidate.id === id);
      if (item) void command.change(item.listingId, Math.max(0, quantity), item.lineVersion, item.selected);
    },
    removeCartItem: async (id: string) => {
      const item = cartView.lines.find((candidate) => candidate.id === id);
      if (item) await command.change(item.listingId, 0, item.lineVersion);
    },
    navigateTo,
    selected: selectedLines,
    allSelected: cartView.lines.length > 0 && selectedLines.length === cartView.lines.length,
    actions: Object.freeze({
      browse: () => void navigate(ROUTES.storecatalog),
      checkout: () => navigateTo('checkout'),
      refresh: () => { command.refresh(); void catalog.refresh(); },
    }),
  });
}
