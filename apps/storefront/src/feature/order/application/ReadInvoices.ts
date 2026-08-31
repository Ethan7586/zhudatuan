import type { StorefrontSession } from '../../../shared/api/Session';
import { InvoiceGateway } from '../infrastructure/InvoiceGateway';
import type { Invoice } from '../model/Invoice';

export async function readInvoices(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Invoice[]> {
  const value = await InvoiceGateway.read(session, signal);
  return Object.freeze(value.items.map((item) => Object.freeze(item)));
}
