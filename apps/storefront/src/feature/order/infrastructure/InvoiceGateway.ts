import type { OperationOutputFor } from '@shop/contract';
import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';

export const InvoiceGateway = Object.freeze({
  read(session: StorefrontSession, signal?: AbortSignal): Promise<OperationOutputFor<'finance.invoices.read'>> {
    return storefrontClient.commerce.finance.invoicesRead({ query: { limit: 50 } }, storefrontClient.context(session, { signal }));
  },
  download(session: StorefrontSession, invoiceId: string, signal?: AbortSignal): Promise<OperationOutputFor<'finance.invoices.download'>> {
    return storefrontClient.commerce.finance.invoicesDownload({ path: { invoiceid: invoiceId } }, storefrontClient.context(session, { signal }));
  },
});
