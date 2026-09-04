import { useRef, useState, type SetStateAction } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { routePath, ROUTES } from '../../../generated/RouteBinding';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import { presentProduct } from '../../../entity/product';
import type { Product } from '../../../entity/product';
import { useAccountIdentity } from '../../account';
import { useCartCommand } from '../../cart';
import { ReadProduct } from '../application/ReadProduct';
import { ShareProduct } from '../application/ShareProduct';
import { useDependencies } from '../../../app/DependencyContext';

export function useProductViewModel(routeId: string | null = null) {
  const session = useSession();
  const dependencies = useDependencies();
  const identity = useAccountIdentity();
  const cart = useCartCommand();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const reader = useRef(new ReadProduct(dependencies.product));
  const share = useRef(new ShareProduct());
  const quickId = search.get('quickview');
  const activeId = quickId ?? routeId;
  const [quantity, setQuantity] = useState(1);
  const [selectedSpec, setSelectedSpec] = useState('');
  const [tab, setTab] = useState<'detail' | 'spec' | 'aftersale'>('detail');
  const query = useQuery({
    queryKey: StorefrontQuery.product(session.query.public, activeId ?? 'none'),
    queryFn: ({ signal }) => reader.current.execute(activeId!, signal),
    enabled: Boolean(session.scope && activeId),
  });
  const current = query.data ?? null;
  const presented = current ? presentProduct(current) : null;
  const setQuickViewProduct = (value: SetStateAction<Product | null>) => {
    const product = typeof value === 'function' ? value(current) : value;
    const next = new URLSearchParams(search);
    if (product) next.set('quickview', product.id);
    else next.delete('quickview');
    setSearch(next, { replace: true });
  };
  return Object.freeze({
    user: identity.user,
    addresses: identity.addresses,
    state: query.isPending ? ('loading' as const) : query.isError ? ('failed' as const) : current ? ('ready' as const) : ('empty' as const),
    product: presented,
    presentationProducts: presented ? Object.freeze([presented]) : Object.freeze([]),
    quickViewProduct: quickId ? current : null,
    setQuickViewProduct,
    addToCart: cart.add,
    favorites: identity.favorites,
    toggleFavorite: identity.toggleFavorite,
    shareProduct: async (product: Product) => {
      const result = await share.current.execute(product, new URL(routePath('storeproduct', { productId: product.id }), window.location.origin).toString());
      session.showToast(result === 'shared' ? '商品已分享' : '商品链接已复制', 'success');
    },
    showToast: session.showToast,
    quantity,
    selectedSpec,
    tab,
    actions: Object.freeze({
      changeQuantity: (value: number) => setQuantity(Math.max(1, Math.min(current?.stock ?? 1, value))),
      selectSpec: setSelectedSpec,
      selectTab: setTab,
      add: () => {
        if (current) void cart.add(current, quantity);
      },
      buy: () => {
        if (current) {
          void cart.add(current, quantity);
          void navigate(ROUTES.storecart);
        }
      },
      closeQuickView: () => setQuickViewProduct(null),
      addQuickView: (quantity: number, specs: Readonly<Record<string, string>>) => {
        if (!current) return;
        cart.add(current, quantity, specs);
        setQuickViewProduct(null);
      },
      buyQuickView: (quantity: number, specs: Readonly<Record<string, string>>) => {
        if (!current) return;
        cart.add(current, quantity, specs);
        setQuickViewProduct(null);
        void navigate(ROUTES.storecart);
      },
      back: () => void navigate(ROUTES.storecatalog),
    }),
  });
}
