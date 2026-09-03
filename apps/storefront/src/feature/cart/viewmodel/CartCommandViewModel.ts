import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import type { Product } from '../../../entity/product';
import { ReadCart } from '../application/ReadCart';
import { ChangeCart } from '../application/ChangeCart';
import { useDependencies } from '../../../app/DependencyContext';

export function useCartCommand() {
  const session = useSession();
  const dependencies = useDependencies();
  const client = useQueryClient();
  const command = useRef(new ChangeCart(dependencies.cart));
  const reader = useRef(new ReadCart(dependencies.cart));
  const scope = session.scope || 'guest';
  const cart = useQuery({
    queryKey: StorefrontQuery.cart(scope),
    queryFn: ({ signal }) => reader.current.execute(session.session!, signal),
    enabled: session.status === 'authenticated',
  });

  const change = async (listingId: string, quantity: number, lineVersion: number | null) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await command.current.execute(session.session, {
      listingId,
      quantity,
      lineVersion,
      cartVersion: Number(cart.data?.version ?? 0),
    });
    await client.invalidateQueries({ queryKey: StorefrontQuery.cart(scope) });
  };

  const add = (product: Product, quantity = 1, _selectedSpec: Readonly<Record<string, string>> = {}) => {
    const current = cart.data?.items.find(({ listing, sku }) => listing === product.id && sku === product.skuId);
    const nextQuantity = Number(current?.quantity ?? 0) + quantity;
    if (!product.purchasable || product.stock < nextQuantity || !Number.isSafeInteger(quantity) || quantity < 1) {
      session.showToast('商品当前不可购买，请刷新商品信息后重试', 'error');
      return;
    }
    void change(product.id, nextQuantity, current ? Number(current.version) : null)
      .then(() => session.showToast('已加入购物车', 'success'))
      .catch(() => session.showToast('购物车更新失败，请刷新后重试', 'error'));
  };

  return Object.freeze({ cart: cart.data, add, change });
}
