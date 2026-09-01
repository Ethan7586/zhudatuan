import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { InvoiceIssuer } from '../../application/port/InvoiceIssuer';
import type { FinanceJobExecution, InvoiceJobProcess } from '../../application/port/FinanceJobProcess';

export class PgInvoiceProcess implements InvoiceJobProcess {
  constructor(
    private readonly manager: TransactionManager,
    private readonly objects: ObjectStore,
    private readonly kms: KmsClient,
    private readonly issuer: InvoiceIssuer,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  async issue(request: string, execution: FinanceJobExecution): Promise<void> {
    const options = transactionOptions(execution);
    const invoice = await this.manager.write(options, async (context) => {
      const database = this.transactions.database(context);
      const selected = await database.query<InvoiceRow>(
        `update invoice.request request set state='issuing',version=version+1
        from invoice.requestprofile profile where request.id=$1 and profile.request_id=request.id and request.state in('approved','issuing')
        returning request.id,profile.owner_id,request.amount_minor::float8 amount_minor,request.currency,request.profile_id,
          request.kind,request.red_of_request_id,profile.title_ciphertext,profile.taxid_ciphertext,profile.address_ciphertext`,
        [request]
      );
      if (selected.rows[0]) return selected.rows[0];
      const complete = await database.query(`select 1 from invoice.request where id=$1 and state in('issued','red')`, [request]);
      if (complete.rows[0]) return null;
      throw new Error('INVOICE_NOT_RUNNABLE');
    });
    if (!invoice) {
      return;
    }
    const original =
      invoice.red_of_request_id === null
        ? undefined
        : await this.manager.read(options, async (context) => {
            const result = await this.transactions.database(context).query<{ id: string; external_id: string }>(
              `select document.id,document.external_id
      from invoice.document document join invoice.request request on request.id=document.request_id
      where request.id=$1 and request.state='issued' and document.kind='original'`,
              [invoice.red_of_request_id]
            );
            return result.rows[0];
          });
    if (invoice.kind === 'red' && !original) throw new Error('INVOICE_ORIGINAL_DOCUMENT_MISSING');
    const lines = await this.manager.read(options, (context) =>
      this.transactions.database(context).query<{ description: string; amount_minor: number; tax_minor: number }>(
        `select description,amount_minor::float8 amount_minor,
      tax_minor::float8 tax_minor from invoice.line where request_id=$1 order by sequence`,
        [invoice.id]
      )
    );
    const context = { owner: invoice.owner_id };
    const [title, taxid, address] = await Promise.all([
      this.kms.decrypt('pii', 'pii/invoice', invoice.title_ciphertext, { ...context, field: 'title' }),
      this.kms.decrypt('pii', 'pii/invoice', invoice.taxid_ciphertext, { ...context, field: 'taxid' }),
      invoice.address_ciphertext === null ? Promise.resolve(undefined) : this.kms.decrypt('pii', 'pii/invoice', invoice.address_ciphertext, { ...context, field: 'address' }),
    ]);
    const issued = await this.issuer.issue({
      request: invoice.id,
      kind: invoice.kind,
      ...(original === undefined ? {} : { originalExternalId: original.external_id }),
      title,
      taxid,
      ...(address === undefined ? {} : { address }),
      amountMinor: invoice.amount_minor,
      currency: invoice.currency,
      lines: lines.rows.map((line) => ({ description: line.description, amountMinor: line.amount_minor, taxMinor: line.tax_minor })),
    });
    const upload = await this.objects.create(`invoices/${invoice.id}.pdf`, issued.contentType);
    try {
      await upload.append(issued.document);
      const stored = await upload.complete();
      await this.manager.write(options, async (transaction) => {
        const database = this.transactions.database(transaction);
        await database.query(
          `insert into invoice.document(id,request_id,provider,external_id,object_ref,sha256,issued_at,kind,red_of_id)
          values($1,$2,$3,$4,$5,$6,clock_timestamp(),$7,$8) on conflict(request_id) do update set provider=excluded.provider,
          external_id=excluded.external_id,object_ref=excluded.object_ref,sha256=excluded.sha256,issued_at=excluded.issued_at`,
          [`document:${invoice.id}`, invoice.id, issued.provider, issued.externalId, stored.reference, stored.sha256, invoice.kind, original?.id ?? null]
        );
        const updated = await database.query(`update invoice.request set state='issued',version=version+1 where id=$1 and state='issuing' returning id`, [invoice.id]);
        if (!updated.rows[0]) throw new Error('INVOICE_STATE_CONFLICT');
        await database.query(
          `insert into invoice.statusevent(request_id,sequence,state,occurred_at) select $1,coalesce(max(sequence),0)+1,'issued',clock_timestamp()
          from invoice.statusevent where request_id=$1`,
          [invoice.id]
        );
        if (invoice.red_of_request_id !== null) {
          await database.query(`update invoice.request set state='red',version=version+1 where id=$1 and state='issued'`, [invoice.red_of_request_id]);
          await database.query(
            `insert into invoice.statusevent(request_id,sequence,state,occurred_at) select $1,coalesce(max(sequence),0)+1,'red',clock_timestamp()
            from invoice.statusevent where request_id=$1`,
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
          payload: { request: invoice.id, kind: invoice.kind, amountMinor: invoice.amount_minor, currency: invoice.currency, documentHash: stored.sha256 },
          trace: eventId,
        });
      });
    } catch (cause) {
      await upload.abort();
      throw cause;
    }
  }
}

function transactionOptions(execution: FinanceJobExecution): TransactionOptions {
  return {
    tenant: execution.scope,
    membership: '',
    scope: execution.scope,
    actor: 'job:invoice',
    trace: execution.trace,
    operation: 'job.finance.invoice',
    workload: 'jobs',
    signal: execution.signal,
    deadline: execution.deadline,
  };
}

interface InvoiceRow {
  readonly id: string;
  readonly owner_id: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly profile_id: string;
  readonly kind: 'original' | 'red';
  readonly red_of_request_id: string | null;
  readonly title_ciphertext: string;
  readonly taxid_ciphertext: string;
  readonly address_ciphertext: string | null;
}
