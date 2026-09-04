import { token } from '../../../../bootstrap/Container';

export interface InvoiceInput {
  readonly request: string;
  readonly kind: 'original' | 'red';
  readonly originalExternalId?: string;
  readonly title: string;
  readonly taxid: string;
  readonly address?: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly lines: readonly Readonly<{ description: string; amountMinor: number; taxMinor: number }>[];
}

export interface IssuedInvoice {
  readonly externalId: string;
  readonly provider: string;
  readonly document: Uint8Array;
  readonly contentType: 'application/pdf';
}

export interface InvoiceIssuer { issue(input: InvoiceInput): Promise<IssuedInvoice> }
export const INVOICE_ISSUER = token<InvoiceIssuer>('finance.invoiceissuer');
