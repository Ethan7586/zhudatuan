import type { StorefrontSession } from '../../../shared/api/Session';
import { InvoiceGateway } from '../infrastructure/InvoiceGateway';
import type { InvoiceDownload } from '../model/Invoice';

export class DownloadInvoice {
  execute(session: StorefrontSession, invoiceId: string, signal?: AbortSignal): Promise<InvoiceDownload> {
    return InvoiceGateway.download(session, invoiceId, signal);
  }
}
