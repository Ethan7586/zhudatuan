import { useRef, type SetStateAction } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../../shared/runtime/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import { pathForPage, pathForRoute, resourceId } from '../../../shared/manifest/StorefrontRoute';
import { presentProduct } from '../../../shared/api/ProductMapper';
import type { ProductView } from '../../../shared/runtime/StorefrontPort';
import { useAccountIdentity } from '../../account/public/index';
import { useCartCommand } from '../../cart/public/index';
import { ReadProduct } from './ReadProduct';
import { ShareProduct } from './ShareProduct';

export function useProductRuntime() {
  const session = useSession();
  const identity = useAccountIdentity();
  const cart = useCartCommand();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const reader = useRef(new ReadProduct());
  const share = useRef(new ShareProduct());
  const routeId = resourceId(location.pathname, 'products');
  const quickId = search.get('quickview');
  const activeId = quickId ?? routeId;
  const query = useQuery({
    queryKey: StorefrontQuery.product(session.scope || 'guest', activeId ?? 'none'),
    queryFn: ({ signal }) => reader.current.execute(activeId!, signal),
    enabled: Boolean(session.scope && activeId),
  });
  const current = query.data ?? null;
  const setQuickViewProduct = (value: SetStateAction<ProductView | null>) => {
    const product = typeof value === 'function' ? value(current) : value;
    const next = new URLSearchParams(search);
    if (product) next.set('quickview', product.id);
    else next.delete('quickview');
    setSearch(next, { replace: true });
  };
  return Object.freeze({
    user: identity.user,
    addresses: identity.addresses,
    presentationProducts: current ? Object.freeze([presentProduct(current)]) : Object.freeze([]),
    quickViewProduct: quickId ? current : null,
    setQuickViewProduct,
    addToCart: cart.add,
    setLaptopPage: (page: Parameters<typeof pathForPage>[0]) => {
      void navigate(pathForPage(page));
    },
    navigateTo: (route: Parameters<typeof pathForRoute>[0], params?: Readonly<Record<string, unknown>>) => {
      void navigate(pathForRoute(route, params));
    },
    favorites: identity.favorites,
    toggleFavorite: identity.toggleFavorite,
    shareProduct: async (product: ProductView) => {
      const result = await share.current.execute(product, `${window.location.origin}/products/${encodeURIComponent(product.id)}`);
      session.showToast(result === 'shared' ? '商品已分享' : '商品链接已复制', 'success');
    },
    showToast: session.showToast,
  });
}
