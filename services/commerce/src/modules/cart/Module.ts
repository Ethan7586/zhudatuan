import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { defineModule } from '../../bootstrap/DefinedModule';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { CART_CATALOG_PORT } from '../catalog/public';
import { CART_EXPERIENCE_PORT } from '../experience/public';
import { CART_PRICING_PORT } from '../pricing/public';
import { CurrentReadHandler } from './application/handler/CurrentReadHandler';
import { ItemsBatchHandler } from './application/handler/ItemsBatchHandler';
import { ItemsPutHandler } from './application/handler/ItemsPutHandler';
import { PgCartOfferRepository } from './infrastructure/persistence/PgCartOfferRepository';
import { PgCartOwnerRepository } from './infrastructure/persistence/PgCartOwnerRepository';
import { PgCartPublicPort } from './infrastructure/persistence/PgCartPublicPort';
import { PgCartRepository } from './infrastructure/persistence/PgCartRepository';
import { Manifest } from './Manifest';
import { CART_READ_PORT, CHECKOUT_CART_PORT } from './public';

export const CartModule = defineModule(Manifest, {
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const carts = new PgCartRepository(transactions);
    const owners = new PgCartOwnerRepository(transactions, context.ports.get(MEMBER_ACCESS_PORT), context.ports.get(CART_EXPERIENCE_PORT));
    const offers = new PgCartOfferRepository(transactions, context.ports.get(CART_CATALOG_PORT), context.ports.get(CART_PRICING_PORT));
    return [new CurrentReadHandler(carts, owners), new ItemsPutHandler(carts, owners, offers), new ItemsBatchHandler(carts, owners, offers)];
  },
  ports: () => {
    const cart = new PgCartPublicPort();
    return [
      { token: CHECKOUT_CART_PORT, value: cart },
      { token: CART_READ_PORT, value: cart },
    ];
  },
});
