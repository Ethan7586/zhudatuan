import type { FinanceOperations } from '@shop/sdk/finance';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { Invoice, InvoiceDownload } from '../model/Invoice';
import type { InvoicePort } from '../public/OrderPort';
import { readCursorPages } from '../../../shared/api/CursorPage';

export class InvoiceGateway implements InvoicePort {
  constructor(
    private readonly finance: FinanceOperations,
    private readonly context: RequestContextFactory
  ) {}
  async read(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Invoice[]> {
    const pages = await readCursorPages((cursor) => this.finance.invoicesRead({ query: { limit: 50, ...(cursor ? { cursor } : {}) } }, this.context(session, { signal })), signal);
    return Object.freeze(pages.flatMap((page) => page.items.map((item) => Object.freeze(item))));
  }
  async download(session: StorefrontSession, invoiceId: string, signal?: AbortSignal): Promise<InvoiceDownload> {
    return this.finance.invoicesDownload({ path: { invoiceid: invoiceId } }, this.context(session, { signal }));
  }
}
