import type { OperationOutputFor } from '@shop/contract';
import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';

export class InvoiceGateway {
  constructor(private readonly finance: StorefrontClient['commerce']['finance'], private readonly context: StorefrontClient['context']) {}
  read(session: StorefrontSession, signal?: AbortSignal): Promise<OperationOutputFor<'finance.invoices.read'>> {
    return this.finance.invoicesRead({ query: { limit: 50 } }, this.context(session, { signal }));
  }
  download(session: StorefrontSession, invoiceId: string, signal?: AbortSignal): Promise<OperationOutputFor<'finance.invoices.download'>> {
    return this.finance.invoicesDownload({ path: { invoiceid: invoiceId } }, this.context(session, { signal }));
  }
}
