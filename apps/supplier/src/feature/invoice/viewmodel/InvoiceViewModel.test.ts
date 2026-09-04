import { expect, it } from 'vitest'; import { invoiceViewModel } from './InvoiceViewModel';
it('binds invoices', () => expect(invoiceViewModel.routes).toEqual(['supplierinvoice']));
