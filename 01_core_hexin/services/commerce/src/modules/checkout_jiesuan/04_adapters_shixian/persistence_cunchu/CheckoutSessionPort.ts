import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export class CheckoutSessionPort {
  async confirm(database: OperationDatabase, checkout: string): Promise<void> {
    const changed = await database.query(`update checkout.session set state='confirmed',version=version+1
      where id=$1 and state='quoted' returning id`, [checkout]);
    if (!changed.rows[0]) throw new Error('CHECKOUT_CONFIRMATION_CONFLICT');
  }

  expire(database: OperationDatabase, checkout: string | null) {
    return database.query<{ id: string }>(`update checkout.session set state='expired',version=version+1
      where state in('draft','quoted') and expires_at<=clock_timestamp() and ($1::text is null or id=$1) returning id`, [checkout]);
  }


  async purge(database: OperationDatabase): Promise<void> {
    await database.query(`delete from checkout.session where expires_at<clock_timestamp()-interval '7 days' and state='expired'`);
  }
}

export const checkoutSessionPort = new CheckoutSessionPort();
