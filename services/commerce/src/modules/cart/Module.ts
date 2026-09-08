import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { defineModule } from '../../composition/DefinedModule';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { CART_CATALOG_PORT } from '../catalog/public';
import { CART_EXPERIENCE_PORT, EXPERIENCE_READ_PORT } from '../experience/public';
import { INVENTORY_READ_PORT } from '../inventory/public';
import { CART_PRICING_PORT } from '../pricing/public';
import { CurrentReadHandler } from './application/handler/CurrentReadHandler';
import { ItemsBatchHandler } from './application/handler/ItemsBatchHandler';
import { ItemsPutHandler } from './application/handler/ItemsPutHandler';
import { MergeCartHandler } from './application/handler/MergeCartHandler';
import { MergeCart } from './application/process/MergeCart';
import { CartActor } from './application/service/CartActor';
import { CartReader } from './application/service/CartReader';
import { ChangeCart } from './application/service/ChangeCart';
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
    const owners = new PgCartOwnerRepository(context.ports.get(MEMBER_ACCESS_PORT), context.ports.get(CART_EXPERIENCE_PORT), context.ports.get(EXPERIENCE_READ_PORT));
    const offers = new PgCartOfferRepository(context.ports.get(CART_CATALOG_PORT), context.ports.get(CART_PRICING_PORT), context.ports.get(INVENTORY_READ_PORT));
    const actor = new CartActor(owners);
    const reader = new CartReader(offers);
    const change = new ChangeCart(carts, offers, reader);
    return [new CurrentReadHandler(carts, actor, reader), new ItemsPutHandler(actor, change), new ItemsBatchHandler(actor, change), new MergeCartHandler(actor, new MergeCart(carts), reader)];
  },
  ports: () => {
    const cart = new PgCartPublicPort(new PgTransactionAccess());
    return [
      { token: CHECKOUT_CART_PORT, value: cart },
      { token: CART_READ_PORT, value: cart },
    ];
  },
});
