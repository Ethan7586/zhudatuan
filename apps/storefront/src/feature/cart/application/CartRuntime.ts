import { useNavigate, useSearchParams } from 'react-router';
import { pathForRoute } from '../../../shared/manifest/StorefrontRoute';
import { useAccountIdentity } from '../../account/public/index';
import { useCatalogState } from '../../catalog/public/index';
import { mapCart } from '../infrastructure/CartMapper';
import { useCartCommand } from '../public/CartCommand';

export function useCartRuntime() {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const identity = useAccountIdentity();
  const command = useCartCommand();
  const listingIds = Object.freeze(command.cart?.items.map(({ listing }) => listing) ?? []);
  const catalog = useCatalogState({ listingIds }, command.cart !== undefined && listingIds.length > 0);
  const selected = new Set(search.getAll('line'));
  const cartView = mapCart(command.cart, catalog.products, selected);
  const writeSelection = (ids: readonly string[]) => {
    const next = new URLSearchParams(search);
    next.delete('line');
    ids.forEach((id) => next.append('line', id));
    setSearch(next, { replace: true });
  };
  const toggleCartItemSelected = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeSelection([...next]);
  };
  const navigateTo = (route: Parameters<typeof pathForRoute>[0], params?: Readonly<Record<string, unknown>>) => {
    const path = pathForRoute(route, params);
    const lines = search.getAll('line');
    if (route !== 'checkout' || lines.length === 0) {
      void navigate(path);
      return;
    }
    const target = new URL(path, window.location.origin);
    lines.forEach((id) => target.searchParams.append('line', id));
    void navigate(`${target.pathname}${target.search}`);
  };
  return Object.freeze({
    cart: cartView.lines,
    isLoading: command.cart === undefined || (listingIds.length > 0 && catalog.state === 'loading'),
    user: identity.user,
    addresses: identity.addresses,
    toggleCartItemSelected,
    toggleSelectAllCart: (value: boolean) => writeSelection(value ? cartView.lines.map(({ id }) => id) : []),
    updateCartQuantity: (id: string, quantity: number) => {
      const item = cartView.lines.find((candidate) => candidate.id === id);
      if (item) void command.change(item.listingId, Math.max(0, quantity), item.lineVersion);
    },
    removeCartItem: async (id: string) => {
      const item = cartView.lines.find((candidate) => candidate.id === id);
      if (item) await command.change(item.listingId, 0, item.lineVersion);
    },
    navigateTo,
  });
}
