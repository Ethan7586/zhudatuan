import { createHash } from 'node:crypto';
import type { StoredObject } from '../../../runtime/public/ObjectPort';
import type { TransactionOptions } from '../../../../platform/database/TransactionManager';
import type { IssuedInvoice } from '../../application/port/InvoiceIssuer';
import type { FinanceJobExecution } from '../../application/port/FinanceJobProcess';
import { financeFingerprint } from '../../domain/value/FinanceFingerprint';
import { InputWatermark } from '../../domain/value/InputWatermark';

export function invoiceHash(invoice: InvoiceRow, lines: readonly InvoiceLineRow[], original: OriginalDocument | undefined): string {
  const serialized = lines.map((line) => [line.id, line.description, line.amount_minor, line.tax_minor].join('\u001f')).join('\u001e');
  return financeFingerprint([
    'invoice-v1',
    invoice.id,
    invoice.owner_id,
    invoice.profile_id,
    invoice.settlement_id,
    invoice.kind,
    invoice.red_of_request_id ?? '',
    original?.external_id ?? '',
    invoice.amount_minor,
    invoice.currency,
    invoice.source_hash,
    invoice.profile_version,
    invoice.title_ciphertext,
    invoice.taxid_ciphertext,
    invoice.address_ciphertext ?? '',
    serialized,
  ]);
}

export function invoiceResultHash(issued: IssuedInvoice, documentHash: string): string {
  return financeFingerprint(['invoice-result-v1', issued.provider, issued.externalId, documentHash]);
}

export function assertDocument(document: InvoiceDocument | undefined, invoice: InvoiceRow, original: OriginalDocument | undefined, issued: IssuedInvoice, stored: StoredObject): void {
  if (
    !document ||
    document.id !== `document:${invoice.id}` ||
    document.provider !== issued.provider ||
    document.external_id !== issued.externalId ||
    document.object_ref !== stored.reference ||
    document.sha256 !== stored.sha256 ||
    document.kind !== invoice.kind ||
    document.red_of_id !== (original?.id ?? null)
  )
    throw new Error('INVOICE_DOCUMENT_RECEIPT_CONFLICT');
}

export function requiredHash(value: string | null): string {
  if (value === null) throw new Error('FINANCE_INPUT_WATERMARK_MISSING');
  return value;
}
export function date(value: string | null): string {
  if (value === null) throw new Error('FINANCE_INPUT_WATERMARK_MISSING');
  return new Date(value).toISOString();
}

export function transactionOptions(execution: FinanceJobExecution): TransactionOptions {
  return { tenant: execution.scope, membership: '', scope: execution.scope, actor: 'job:invoice', trace: execution.trace, operation: 'job.finance.invoice', workload: 'jobs', signal: execution.signal, deadline: execution.deadline };
}

export interface InvoiceRow {
  readonly id: string;
  readonly owner_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly profile_id: string;
  readonly settlement_id: string;
  readonly kind: 'original' | 'red';
  readonly red_of_request_id: string | null;
  readonly requested_by: string;
  readonly approved_by: string;
  readonly version: number;
  readonly state: string;
  readonly source_hash: string;
  readonly issue_hash: string | null;
  readonly issue_count: number | null;
  readonly issue_watermark: string | null;
  readonly created_at: string;
  readonly title_ciphertext: string;
  readonly taxid_ciphertext: string;
  readonly address_ciphertext: string | null;
  readonly profile_version: number;
}
export interface InvoiceLineRow {
  readonly id: string;
  readonly description: string;
  readonly amount_minor: number;
  readonly tax_minor: number;
}
export interface OriginalDocument {
  readonly id: string;
  readonly external_id: string;
}
export interface PreparedInvoice {
  readonly invoice: InvoiceRow;
  readonly lines: readonly InvoiceLineRow[];
  readonly original: OriginalDocument | undefined;
  readonly watermark: InputWatermark;
}
export interface InvoiceDocument {
  readonly id: string;
  readonly provider: string;
  readonly external_id: string;
  readonly object_ref: string;
  readonly sha256: string;
  readonly kind: 'original' | 'red';
  readonly red_of_id: string | null;
}
