import { createHash } from 'node:crypto';
import type { ObjectStore, StoredObject } from '../../../runtime/public/ObjectPort';
import type { KmsClient } from '../../../../foundation/application/KmsPort';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { InvoiceIssuer, IssuedInvoice } from '../../application/port/InvoiceIssuer';
import type { FinanceJobExecution, InvoiceJobProcess } from '../../application/port/FinanceJobProcess';
import { Invoice } from '../../domain/model/Invoice';
import { InputWatermark } from '../../domain/value/InputWatermark';
import { financeFingerprint } from '../../domain/value/FinanceFingerprint';

export class PgInvoiceProcess implements InvoiceJobProcess {
  constructor(
    private readonly manager: TransactionManager,
    private readonly objects: ObjectStore,
    private readonly kms: KmsClient,
    private readonly issuer: InvoiceIssuer,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  async issue(input: Readonly<{ request: string; business: string }>, execution: FinanceJobExecution): Promise<void> {
    if (input.business !== input.request) throw new Error('INVOICE_BUSINESS_NUMBER_INVALID');
    const options = transactionOptions(execution);
    const prepared = await this.prepare(input.request, options);
    if (!prepared) return;
    const invoice = prepared.invoice;
    const aggregate = Invoice.restore({
      id: invoice.id,
      profileId: invoice.profile_id,
      settlementId: invoice.settlement_id,
      amountMinor: invoice.amount_minor,
      currency: invoice.currency,
      kind: invoice.kind,
      redOf: invoice.red_of_request_id,
      state: 'issuing',
      lines: prepared.lines.map((line) => ({ id: line.id, description: line.description, amountMinor: line.amount_minor, taxMinor: line.tax_minor })),
      requestedBy: invoice.requested_by,
      approvedBy: invoice.approved_by,
      version: invoice.version,
    });
    const context = { owner: invoice.owner_id };
    const [title, taxid, address] = await Promise.all([
      this.kms.decrypt('pii', 'pii/invoice', invoice.title_ciphertext, { ...context, field: 'title' }),
      this.kms.decrypt('pii', 'pii/invoice', invoice.taxid_ciphertext, { ...context, field: 'taxid' }),
      invoice.address_ciphertext === null
        ? Promise.resolve(undefined)
        : this.kms.decrypt('pii', 'pii/invoice', invoice.address_ciphertext, { ...context, field: 'address' }),
    ]);
    const issued = await this.issuer.issue({
      request: invoice.id,
      inputHash: prepared.watermark.snapshot().hash,
      kind: invoice.kind,
      ...(prepared.original === undefined ? {} : { originalExternalId: prepared.original.external_id }),
      title,
      taxid,
      ...(address === undefined ? {} : { address }),
      amountMinor: invoice.amount_minor,
      currency: invoice.currency,
      lines: aggregate.snapshot().lines.map((line) => ({ description: line.description, amountMinor: line.amountMinor, taxMinor: line.taxMinor })),
    });
    const stored = await this.store(invoice.id, issued);
    await this.manager.write(options, async (transaction) => {
      const database = this.transactions.database(transaction);
      const completed = aggregate.issue().snapshot();
      await database.query(
        `insert into invoice.document(id,request_id,provider,external_id,object_ref,sha256,issued_at,kind,red_of_id)
        values($1,$2,$3,$4,$5,$6,clock_timestamp(),$7,$8) on conflict(request_id) do nothing`,
        [`document:${invoice.id}`, invoice.id, issued.provider, issued.externalId, stored.reference, stored.sha256,
          invoice.kind, prepared.original?.id ?? null]
      );
      const document = await database.query<InvoiceDocument>(
        `select id,provider,external_id,object_ref,sha256,kind,red_of_id from invoice.document where request_id=$1 for update`,
        [invoice.id]
      );
      assertDocument(document.rows[0], invoice, prepared.original, issued, stored);
      const updated = await database.query(
        `update invoice.request set state=$2,version=$3,provider=$6,provider_reference=$7,response_hash=$8
        where id=$1 and state='issuing' and version=$4 and issue_hash=$5 returning id`,
        [invoice.id, completed.state, completed.version, invoice.version, prepared.watermark.snapshot().hash,
          issued.provider, issued.externalId, invoiceResultHash(issued, stored.sha256)]
      );
      if (!updated.rows[0]) {
        const complete = await database.query(`select 1 from invoice.request where id=$1 and state='issued' and issue_hash=$2`,
          [invoice.id, prepared.watermark.snapshot().hash]);
        if (!complete.rows[0]) throw new Error('INVOICE_STATE_CONFLICT');
        return;
      }
      await database.query(
        `insert into invoice.statusevent(request_id,sequence,state,occurred_at)
        select $1,coalesce(max(sequence),0)+1,'issued',clock_timestamp() from invoice.statusevent where request_id=$1`,
        [invoice.id]
      );
      if (invoice.red_of_request_id !== null) {
        const red = await database.query(
          `update invoice.request set state='red',version=version+1 where id=$1 and state='issued' returning id`,
          [invoice.red_of_request_id]
        );
        if (!red.rows[0]) throw new Error('INVOICE_ORIGINAL_STATE_CONFLICT');
        await database.query(
          `insert into invoice.statusevent(request_id,sequence,state,occurred_at)
          select $1,coalesce(max(sequence),0)+1,'red',clock_timestamp() from invoice.statusevent where request_id=$1`,
          [invoice.red_of_request_id]
        );
      }
      const event = invoice.kind === 'red' ? 'invoice.red.issued' : 'invoice.issued';
      const eventId = `event:finance:invoice:${invoice.id}`;
      await new PgRuntimeWriter(database).append({
        id: eventId,
        type: event,
        aggregateType: 'invoice',
        aggregate: invoice.id,
        scope: invoice.owner_id,
        payload: { request: invoice.id, kind: invoice.kind, amountMinor: invoice.amount_minor,
          currency: invoice.currency, provider: issued.provider, providerReference: issued.externalId,
          documentHash: stored.sha256, inputHash: prepared.watermark.snapshot().hash },
        trace: eventId,
      });
    });
  }

  private async prepare(request: string, options: TransactionOptions): Promise<PreparedInvoice | null> {
    return this.manager.write(options, async (context) => {
      const database = this.transactions.database(context);
      await database.query(`select pg_advisory_xact_lock(hashtextextended('finance:invoice:'||$1,0))`, [request]);
      const selected = await database.query<InvoiceRow>(
        `select request.id,profile.owner_id,request.amount_minor::float8 amount_minor,request.currency,request.profile_id,
        request.settlement_id,request.kind,request.red_of_request_id,request.requested_by,request.approved_by,
        request.version::float8 version,request.state,request.source_hash,request.issue_hash,request.issue_count,
        request.issue_watermark,request.created_at,
        profile.title_ciphertext,profile.taxid_ciphertext,profile.address_ciphertext,profile.profile_version::float8 profile_version
        from invoice.request request join invoice.requestprofile profile on profile.request_id=request.id
        where request.id=$1 for update of request`,
        [request]
      );
      const invoice = selected.rows[0];
      if (!invoice) throw new Error('INVOICE_NOT_RUNNABLE');
      if (invoice.state === 'issued' || invoice.state === 'red') return null;
      if (invoice.state !== 'approved' && invoice.state !== 'issuing') throw new Error('INVOICE_NOT_RUNNABLE');
      const lines = await database.query<InvoiceLineRow>(
        `select sequence::text id,description,amount_minor::float8 amount_minor,tax_minor::float8 tax_minor
        from invoice.line where request_id=$1 order by sequence for update`,
        [invoice.id]
      );
      const original = invoice.red_of_request_id === null
        ? undefined
        : (await database.query<OriginalDocument>(
            `select document.id,document.external_id from invoice.document document join invoice.request request
            on request.id=document.request_id where request.id=$1 and request.state='issued' and document.kind='original' for update of document`,
            [invoice.red_of_request_id]
          )).rows[0];
      if (invoice.kind === 'red' && !original) throw new Error('INVOICE_ORIGINAL_DOCUMENT_MISSING');
      const hash = invoiceHash(invoice, lines.rows, original);
      let claimed = invoice;
      if (invoice.state === 'approved') {
        if (invoice.issue_hash !== null) {
          InputWatermark.restore({ hash: invoice.issue_hash, count: Number(invoice.issue_count),
            occurredAt: date(invoice.issue_watermark) }).assert(hash, lines.rows.length);
        }
        const result = await database.query<InvoiceRow>(
          `update invoice.request set state='issuing',version=version+1,issue_hash=$2,issue_count=$4,issue_watermark=created_at
          where id=$1 and state='approved' and version=$3 returning version::float8 version,issue_hash,issue_watermark`,
          [invoice.id, hash, invoice.version, lines.rows.length]
        );
        const update = result.rows[0];
        if (!update) throw new Error('INVOICE_CLAIM_CONFLICT');
        claimed = { ...invoice, state: 'issuing', version: update.version, issue_hash: update.issue_hash,
          issue_count: lines.rows.length,
          issue_watermark: update.issue_watermark };
      }
      const watermark = InputWatermark.restore({ hash: requiredHash(claimed.issue_hash), count: Number(claimed.issue_count),
        occurredAt: date(claimed.issue_watermark) });
      watermark.assert(hash, lines.rows.length);
      return Object.freeze({ invoice: claimed, lines: Object.freeze(lines.rows), original, watermark });
    });
  }

  private async store(request: string, issued: IssuedInvoice): Promise<StoredObject> {
    const path = `invoices/${financeFingerprint(['invoice-document-v1', request])}.pdf`;
    const expected = createHash('sha256').update(issued.document).digest('hex');
    const existing = await this.objects.find(path);
    if (existing) {
      if (existing.contentType !== issued.contentType || existing.sha256 !== expected || existing.size !== issued.document.byteLength)
        throw new Error('INVOICE_DOCUMENT_RECOVERY_CONFLICT');
      return existing;
    }
    const upload = await this.objects.create(path, issued.contentType);
    try {
      await upload.append(issued.document);
      const stored = await upload.complete();
      if (stored.sha256 !== expected || stored.size !== issued.document.byteLength) throw new Error('INVOICE_DOCUMENT_INTEGRITY_INVALID');
      return stored;
    } catch (cause) {
      await upload.abort();
      throw cause;
    }
  }
}

function invoiceHash(invoice: InvoiceRow, lines: readonly InvoiceLineRow[], original: OriginalDocument | undefined): string {
  const serialized = lines.map((line) => [line.id, line.description, line.amount_minor, line.tax_minor].join('\u001f')).join('\u001e');
  return financeFingerprint(['invoice-v1', invoice.id, invoice.owner_id, invoice.profile_id, invoice.settlement_id,
    invoice.kind, invoice.red_of_request_id ?? '', original?.external_id ?? '', invoice.amount_minor, invoice.currency,
    invoice.source_hash, invoice.profile_version, invoice.title_ciphertext, invoice.taxid_ciphertext,
    invoice.address_ciphertext ?? '', serialized]);
}

function invoiceResultHash(issued: IssuedInvoice, documentHash: string): string {
  return financeFingerprint(['invoice-result-v1', issued.provider, issued.externalId, documentHash]);
}

function assertDocument(document: InvoiceDocument | undefined, invoice: InvoiceRow, original: OriginalDocument | undefined,
  issued: IssuedInvoice, stored: StoredObject): void {
  if (!document || document.id !== `document:${invoice.id}` || document.provider !== issued.provider ||
    document.external_id !== issued.externalId || document.object_ref !== stored.reference || document.sha256 !== stored.sha256 ||
    document.kind !== invoice.kind || document.red_of_id !== (original?.id ?? null)) throw new Error('INVOICE_DOCUMENT_RECEIPT_CONFLICT');
}

function requiredHash(value: string | null): string { if (value === null) throw new Error('FINANCE_INPUT_WATERMARK_MISSING'); return value; }
function date(value: string | null): string { if (value === null) throw new Error('FINANCE_INPUT_WATERMARK_MISSING'); return new Date(value).toISOString(); }

function transactionOptions(execution: FinanceJobExecution): TransactionOptions {
  return { tenant: execution.scope, membership: '', scope: execution.scope, actor: 'job:invoice', trace: execution.trace,
    operation: 'job.finance.invoice', workload: 'jobs', signal: execution.signal, deadline: execution.deadline };
}

interface InvoiceRow {
  readonly id: string; readonly owner_id: string; readonly amount_minor: number; readonly currency: string;
  readonly profile_id: string; readonly settlement_id: string; readonly kind: 'original' | 'red';
  readonly red_of_request_id: string | null; readonly requested_by: string; readonly approved_by: string;
  readonly version: number; readonly state: string; readonly source_hash: string; readonly issue_hash: string | null;
  readonly issue_count: number | null;
  readonly issue_watermark: string | null; readonly created_at: string; readonly title_ciphertext: string;
  readonly taxid_ciphertext: string; readonly address_ciphertext: string | null; readonly profile_version: number;
}
interface InvoiceLineRow { readonly id: string; readonly description: string; readonly amount_minor: number; readonly tax_minor: number }
interface OriginalDocument { readonly id: string; readonly external_id: string }
interface PreparedInvoice {
  readonly invoice: InvoiceRow; readonly lines: readonly InvoiceLineRow[]; readonly original: OriginalDocument | undefined;
  readonly watermark: InputWatermark;
}
interface InvoiceDocument {
  readonly id: string; readonly provider: string; readonly external_id: string; readonly object_ref: string;
  readonly sha256: string; readonly kind: 'original' | 'red'; readonly red_of_id: string | null;
}
