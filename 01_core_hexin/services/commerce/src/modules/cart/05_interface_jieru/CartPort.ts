import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export class CartPort {
  async convert(database: OperationDatabase, cart: string): Promise<void> {
    const changed = await database.query(`update cart.cart set state='converted',version=version+1,updated_at=clock_timestamp()
      where id=$1 and state='active' returning id`, [cart]);
    if (!changed.rows[0]) throw new Error('CART_CONVERSION_CONFLICT');
  }
}

export const cartPort = new CartPort();
