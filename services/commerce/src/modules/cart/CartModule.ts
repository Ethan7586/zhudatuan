import { defineModule } from '../../bootstrap/DefinedModule';
import { cartOperations } from './CartOperations';
import { Manifest } from './Manifest';
import { CART_READ_PORT, CHECKOUT_CART_PORT } from './public/index';
import { PgCartRepository } from './infrastructure/persistence/PgCartRepository';
export const CartModule = defineModule(Manifest, cartOperations, () => {
  const cart = new PgCartRepository();
  return [
    { token: CHECKOUT_CART_PORT, value: cart },
    { token: CART_READ_PORT, value: cart },
  ];
});
