import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { CheckoutSelection, QuoteCartContext, QuoteContextReader } from '../checkout/CheckoutContractModule';

export class PurchaseCheckoutContext implements QuoteContextReader {
  constructor(private readonly session: string) {}

  async read(database: OperationDatabase, membership: string, selection: CheckoutSelection): Promise<QuoteCartContext> {
    const result = await database.query<QuoteCartContext>(
      'select * from access.purchase_checkout_context($1,$2,$3,$4)',
      [membership, this.session, selection.address, selection.invoice],
    );
    const context = result.rows[0];
    if (!context) throw new Error('CART_EMPTY');
    if (selection.address !== null && context.address_version === null) throw new Error('CHECKOUT_ADDRESS_INVALID');
    if (selection.invoice !== null && context.invoice_version === null) throw new Error('CHECKOUT_INVOICE_INVALID');
    return context;
  }
}
