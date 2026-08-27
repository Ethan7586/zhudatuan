import type { InvoiceInput, InvoiceIssuer, IssuedInvoice } from '../../application/port/InvoiceIssuer';
import { HttpClient } from '../../../../foundation/http/HttpClient';

export interface InvoiceConfiguration { readonly endpoint: string; readonly bearer: string; readonly provider: string }

export class InvoiceGateway implements InvoiceIssuer {
  private readonly http: HttpClient;
  constructor(private readonly configuration: InvoiceConfiguration, fetcher: typeof fetch = fetch) {
    if (!configuration.endpoint.startsWith('https://') || configuration.bearer.length < 16 || !/^[a-z][a-z0-9]{1,31}$/.test(configuration.provider)) {
      throw new Error('INVOICE_CONFIGURATION_INVALID');
    }
    this.http = new HttpClient(fetcher);
  }

  async issue(input: InvoiceInput): Promise<IssuedInvoice> {
    const response = await this.http.send(`${this.configuration.endpoint.replace(/\/$/, '')}/v1/invoices`, {
      method: 'POST', redirect: 'error', headers: {
        accept: 'application/json', authorization: `Bearer ${this.configuration.bearer}`, 'content-type': 'application/json', 'idempotency-key': input.request,
      }, body: JSON.stringify(input),
    }, { mode: 'businesskeywrite' });
    if (!response.ok) throw new Error('INVOICE_PROVIDER_UNAVAILABLE');
    const value = await response.json() as { externalId?: unknown; documentBase64?: unknown; contentType?: unknown };
    if (typeof value.externalId !== 'string' || !value.externalId || typeof value.documentBase64 !== 'string' || value.contentType !== 'application/pdf') {
      throw new Error('INVOICE_PROVIDER_RESPONSE_INVALID');
    }
    const document = Uint8Array.from(Buffer.from(value.documentBase64, 'base64'));
    if (document.byteLength < 5 || new TextDecoder().decode(document.slice(0, 5)) !== '%PDF-') throw new Error('INVOICE_DOCUMENT_INVALID');
    return Object.freeze({ externalId: value.externalId, provider: this.configuration.provider, document, contentType: 'application/pdf' });
  }
}
