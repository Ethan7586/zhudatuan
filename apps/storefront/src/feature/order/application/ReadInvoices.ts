import type { StorefrontSession } from '../../../entity/session';
import { InvoiceGateway } from '../infrastructure/InvoiceGateway';
import type { Invoice } from '../model/Invoice';

export class ReadInvoices {
  constructor(private readonly gateway: Pick<InvoiceGateway, 'read'>) {}
  async execute(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Invoice[]> {
    const value = await this.gateway.read(session, signal);
    return Object.freeze(value.items.map((item) => Object.freeze(item)));
  }
}
