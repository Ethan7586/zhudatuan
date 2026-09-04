import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { InvoiceIssuer } from '../../03_application_yingyong/port/InvoiceIssuer';

export class InvoiceJobProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool, private readonly objects: ObjectStore,
    private readonly kms: KmsClient, private readonly issuer: InvoiceIssuer) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'invoice') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    await this.issue(text(payload.request, 'INVOICE_REQUEST_REQUIRED'));
  }

  private async issue(request: string): Promise<void> {
    const selected = await this.pool.query<InvoiceRow>(`update invoice.request request set state='issuing',version=version+1
      from invoice.requestprofile profile where request.id=$1 and profile.request_id=request.id and request.state in('approved','issuing')
      returning request.id,profile.owner_id,request.amount_minor::float8 amount_minor,request.currency,request.profile_id,
        request.kind,request.red_of_request_id,profile.title_ciphertext,profile.taxid_ciphertext,profile.address_ciphertext`, [request]);
    const invoice = selected.rows[0];
    if (!invoice) {
      const complete = await this.pool.query(`select 1 from invoice.request where id=$1 and state in('issued','red')`, [request]);
      if (complete.rows[0]) return;
      throw new Error('INVOICE_NOT_RUNNABLE');
    }
    const original = invoice.red_of_request_id === null ? undefined : (await this.pool.query<{ id: string; external_id: string }>(`select document.id,document.external_id
      from invoice.document document join invoice.request request on request.id=document.request_id
      where request.id=$1 and request.state='issued' and document.kind='original'`, [invoice.red_of_request_id])).rows[0];
    if (invoice.kind === 'red' && !original) throw new Error('INVOICE_ORIGINAL_DOCUMENT_MISSING');
    const context = { owner: invoice.owner_id };
    const [title, taxid, address, lines] = await Promise.all([
      this.kms.decrypt('pii/invoice', invoice.title_ciphertext, { ...context, field: 'title' }),
      this.kms.decrypt('pii/invoice', invoice.taxid_ciphertext, { ...context, field: 'taxid' }),
      invoice.address_ciphertext === null ? Promise.resolve(undefined)
        : this.kms.decrypt('pii/invoice', invoice.address_ciphertext, { ...context, field: 'address' }),
      this.pool.query<{ description: string; amount_minor: number; tax_minor: number }>(`select description,amount_minor::float8 amount_minor,
        tax_minor::float8 tax_minor from invoice.line where request_id=$1 order by sequence`, [invoice.id]),
    ]);
    const issued = await this.issuer.issue({ request: invoice.id, kind: invoice.kind,
      ...(original === undefined ? {} : { originalExternalId: original.external_id }), title, taxid,
      ...(address === undefined ? {} : { address }), amountMinor: invoice.amount_minor, currency: invoice.currency,
      lines: lines.rows.map((line) => ({ description: line.description, amountMinor: line.amount_minor, taxMinor: line.tax_minor })) });
    const upload = await this.objects.create(`invoices/${invoice.id}.pdf`, issued.contentType);
    try {
      await upload.append(issued.document);
      const stored = await upload.complete();
      const client = await this.pool.connect();
      try {
        await client.query('begin');
        await client.query(`insert into invoice.document(id,request_id,provider,external_id,object_ref,sha256,issued_at,kind,red_of_id)
          values($1,$2,$3,$4,$5,$6,clock_timestamp(),$7,$8) on conflict(request_id) do update set provider=excluded.provider,
          external_id=excluded.external_id,object_ref=excluded.object_ref,sha256=excluded.sha256,issued_at=excluded.issued_at`,
        [`document:${invoice.id}`, invoice.id, issued.provider, issued.externalId, stored.reference, stored.sha256, invoice.kind, original?.id ?? null]);
        const updated = await client.query(`update invoice.request set state='issued',version=version+1 where id=$1 and state='issuing' returning id`, [invoice.id]);
        if (!updated.rows[0]) throw new Error('INVOICE_STATE_CONFLICT');
        await client.query(`insert into invoice.statusevent(request_id,sequence,state,occurred_at) select $1,coalesce(max(sequence),0)+1,'issued',clock_timestamp()
          from invoice.statusevent where request_id=$1`, [invoice.id]);
        if (invoice.red_of_request_id !== null) {
          await client.query(`update invoice.request set state='red',version=version+1 where id=$1 and state='issued'`, [invoice.red_of_request_id]);
          await client.query(`insert into invoice.statusevent(request_id,sequence,state,occurred_at) select $1,coalesce(max(sequence),0)+1,'red',clock_timestamp()
            from invoice.statusevent where request_id=$1`, [invoice.red_of_request_id]);
        }
        const event = invoice.kind === 'red' ? 'invoice.red.issued' : 'invoice.issued';
        await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
          values($1,$2,1,'invoice',$3,$4,jsonb_build_object('request',$3,'kind',$5,'amountMinor',$6,'currency',$7,'documentHash',$8),
          $1,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
        [`event:finance:invoice:${invoice.id}`, event, invoice.id, invoice.owner_id, invoice.kind, invoice.amount_minor, invoice.currency, stored.sha256]);
        await client.query('commit');
      } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
    } catch (cause) { await upload.abort(); throw cause; }
  }
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

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
