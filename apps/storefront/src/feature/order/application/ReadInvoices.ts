import type { StorefrontSession } from '../../../entity/session';
import type { InvoicePort } from '../public/OrderPort';
import type { Invoice } from '../model/Invoice';

export class ReadInvoices {
  constructor(private readonly gateway: Pick<InvoicePort, 'read'>) {}
  async execute(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Invoice[]> {
    return this.gateway.read(session, signal);
  }
}
