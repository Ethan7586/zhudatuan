import type { StorefrontSession } from '../../../entity/session';
import type { InvoicePort } from '../public/OrderPort';
import type { InvoiceDownload } from '../model/Invoice';

export class DownloadInvoice {
  constructor(private readonly gateway: Pick<InvoicePort, 'download'>) {}
  execute(session: StorefrontSession, invoiceId: string, signal?: AbortSignal): Promise<InvoiceDownload> {
    return this.gateway.download(session, invoiceId, signal);
  }
}
