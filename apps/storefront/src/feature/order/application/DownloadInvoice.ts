import type { StorefrontSession } from '../../../entity/session';
import { InvoiceGateway } from '../infrastructure/InvoiceGateway';
import type { InvoiceDownload } from '../model/Invoice';

export class DownloadInvoice {
  constructor(private readonly gateway: Pick<InvoiceGateway, 'download'>) {}
  execute(session: StorefrontSession, invoiceId: string, signal?: AbortSignal): Promise<InvoiceDownload> {
    return this.gateway.download(session, invoiceId, signal);
  }
}
