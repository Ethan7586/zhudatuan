import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { workerTransaction } from '../../../../foundation/infrastructure/WorkerDatabase';
import type { InvoiceIssuer } from '../../application/port/InvoiceIssuer';

export class InvoiceJobProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly objects: ObjectStore,
    private readonly kms: KmsClient,
    private readonly issuer: InvoiceIssuer
  ) {}
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import type { InvoiceIssuer } from '../../application/port/InvoiceIssuer';

export class InvoiceJobProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool, private readonly objects: ObjectStore,
    private readonly kms: KmsClient, private readonly issuer: InvoiceIssuer) {}
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { workerTransaction } from '../../../../foundation/infrastructure/WorkerDatabase';
import type { InvoiceIssuer } from '../../application/port/InvoiceIssuer';

export class InvoiceJobProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly objects: ObjectStore,
    private readonly kms: KmsClient,
    private readonly issuer: InvoiceIssuer
  ) {}
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'invoice') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    if (job.scope_id === null) throw new Error('INVOICE_JOB_SCOPE_REQUIRED');
    const payload = object(job.payload);
    await this.issue(job.scope_id, text(payload.request, 'INVOICE_REQUEST_REQUIRED'));
  }

  private async issue(scope: string, request: string): Promise<void> {
    const selected = await workerTransaction(this.pool, scope, (database) => database.query<InvoiceRow>(`select * from invoice.claim_issue($1)`, [request]));
    const invoice = selected.rows[0];
    if (!invoice) return;
    const claimToken = hex(invoice.claim_token, 'INVOICE_CLAIM_TOKEN_INVALID');
    const claimId = hex(invoice.claim_id, 'INVOICE_CLAIM_ID_INVALID');
    let upload: Awaited<ReturnType<ObjectStore['create']>> | undefined;
    try {
      const amountMinor = safeMinor(invoice.amount_minor, false);
      const lines = invoiceLines(invoice.lines);
      if (invoice.kind === 'red' && invoice.original_external_id === null) throw new Error('INVOICE_ORIGINAL_DOCUMENT_MISSING');
      const context = { owner: invoice.owner_id };
      const [title, taxid, address] = await Promise.all([
        this.kms.decrypt('pii/invoice', invoice.title_ciphertext, { ...context, field: 'title' }),
        this.kms.decrypt('pii/invoice', invoice.taxid_ciphertext, { ...context, field: 'taxid' }),
        invoice.address_ciphertext === null ? Promise.resolve(undefined) : this.kms.decrypt('pii/invoice', invoice.address_ciphertext, { ...context, field: 'address' }),
      ]);
      const issued = await this.issuer.issue({
        request: invoice.id,
        kind: invoice.kind,
        ...(invoice.original_external_id === null ? {} : { originalExternalId: invoice.original_external_id }),
        title,
        taxid,
        ...(address === undefined ? {} : { address }),
        amountMinor,
        currency: invoice.currency,
        lines,
      });
      upload = await this.objects.create(`invoices/${claimId}.pdf`, issued.contentType);
      await upload.append(issued.document);
      const stored = await upload.complete();
      const registered = await workerTransaction(this.pool, scope, (database) =>
        database.query<{ accepted: boolean }>(`select invoice.register_issue_artifact($1,$2,$3,$4,$5,$6) accepted`, [invoice.id, claimToken, issued.provider, issued.externalId, stored.reference, stored.sha256])
      );
      if (registered.rows[0]?.accepted !== true) throw new Error('INVOICE_CLAIM_LOST');
      const finalized = await workerTransaction(this.pool, scope, (database) =>
        database.query<{ accepted: boolean }>(`select invoice.finalize_issue($1,$2,$3,$4,$5,$6,$7) accepted`, [invoice.id, claimToken, invoice.snapshot_hash, issued.provider, issued.externalId, stored.reference, stored.sha256])
      );
      if (finalized.rows[0]?.accepted !== true) throw new Error('INVOICE_CLAIM_LOST');
    } catch (cause) {
      await workerTransaction(this.pool, scope, (database) => database.query(`select invoice.release_issue_claim($1,$2)`, [invoice.id, claimToken])).catch(() => undefined);
      await upload?.abort();
      throw cause;
    }
=======
=======
    if (job.scope_id === null) throw new Error('INVOICE_JOB_SCOPE_REQUIRED');
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const payload = object(job.payload);
    await this.issue(job.scope_id, text(payload.request, 'INVOICE_REQUEST_REQUIRED'));
  }

  private async issue(scope: string, request: string): Promise<void> {
    const selected = await workerTransaction(this.pool, scope, (database) => database.query<InvoiceRow>(`select * from invoice.claim_issue($1)`, [request]));
    const invoice = selected.rows[0];
    if (!invoice) return;
    const claimToken = hex(invoice.claim_token, 'INVOICE_CLAIM_TOKEN_INVALID');
    const claimId = hex(invoice.claim_id, 'INVOICE_CLAIM_ID_INVALID');
    let upload: Awaited<ReturnType<ObjectStore['create']>> | undefined;
    try {
      const amountMinor = safeMinor(invoice.amount_minor, false);
      const lines = invoiceLines(invoice.lines);
      if (invoice.kind === 'red' && invoice.original_external_id === null) throw new Error('INVOICE_ORIGINAL_DOCUMENT_MISSING');
      const context = { owner: invoice.owner_id };
      const [title, taxid, address] = await Promise.all([
        this.kms.decrypt('pii/invoice', invoice.title_ciphertext, { ...context, field: 'title' }),
        this.kms.decrypt('pii/invoice', invoice.taxid_ciphertext, { ...context, field: 'taxid' }),
        invoice.address_ciphertext === null ? Promise.resolve(undefined) : this.kms.decrypt('pii/invoice', invoice.address_ciphertext, { ...context, field: 'address' }),
      ]);
      const issued = await this.issuer.issue({
        request: invoice.id,
        kind: invoice.kind,
        ...(invoice.original_external_id === null ? {} : { originalExternalId: invoice.original_external_id }),
        title,
        taxid,
        ...(address === undefined ? {} : { address }),
        amountMinor,
        currency: invoice.currency,
        lines,
      });
      upload = await this.objects.create(`invoices/${claimId}.pdf`, issued.contentType);
      await upload.append(issued.document);
      const stored = await upload.complete();
<<<<<<< HEAD
=======
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
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      const registered = await workerTransaction(this.pool, scope, (database) =>
        database.query<{ accepted: boolean }>(`select invoice.register_issue_artifact($1,$2,$3,$4,$5,$6) accepted`, [invoice.id, claimToken, issued.provider, issued.externalId, stored.reference, stored.sha256])
      );
      if (registered.rows[0]?.accepted !== true) throw new Error('INVOICE_CLAIM_LOST');
      const finalized = await workerTransaction(this.pool, scope, (database) =>
        database.query<{ accepted: boolean }>(`select invoice.finalize_issue($1,$2,$3,$4,$5,$6,$7) accepted`, [invoice.id, claimToken, invoice.snapshot_hash, issued.provider, issued.externalId, stored.reference, stored.sha256])
      );
      if (finalized.rows[0]?.accepted !== true) throw new Error('INVOICE_CLAIM_LOST');
    } catch (cause) {
      await workerTransaction(this.pool, scope, (database) => database.query(`select invoice.release_issue_claim($1,$2)`, [invoice.id, claimToken])).catch(() => undefined);
      await upload?.abort();
      throw cause;
    }
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  }
}

interface InvoiceRow {
  readonly id: string;
  readonly owner_id: string;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  readonly amount_minor: string;
  readonly currency: string;
  readonly kind: 'original' | 'red';
  readonly red_of_request_id: string | null;
  readonly original_external_id: string | null;
  readonly title_ciphertext: string;
  readonly taxid_ciphertext: string;
  readonly address_ciphertext: string | null;
  readonly lines: unknown;
  readonly snapshot_hash: string;
  readonly claim_token: string;
  readonly claim_id: string;
=======
  readonly amount_minor: number;
=======
  readonly amount_minor: string;
>>>>>>> 018b2a71 (chore(release): capture current production source)
  readonly currency: string;
  readonly kind: 'original' | 'red';
  readonly red_of_request_id: string | null;
  readonly original_external_id: string | null;
  readonly title_ciphertext: string;
  readonly taxid_ciphertext: string;
  readonly address_ciphertext: string | null;
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  readonly lines: unknown;
  readonly snapshot_hash: string;
  readonly claim_token: string;
  readonly claim_id: string;
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  readonly amount_minor: number;
  readonly currency: string;
  readonly profile_id: string;
  readonly kind: 'original' | 'red';
  readonly red_of_request_id: string | null;
  readonly title_ciphertext: string;
  readonly taxid_ciphertext: string;
  readonly address_ciphertext: string | null;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}

function invoiceLines(value: unknown): readonly Readonly<{ description: string; amountMinor: number; taxMinor: number }>[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1_000) throw new Error('INVOICE_LINES_INVALID');
  return value.map((candidate) => {
    const line = object(candidate);
    return Object.freeze({
      description: text(line.description, 'INVOICE_LINE_DESCRIPTION_INVALID'),
      amountMinor: safeMinor(line.amountMinor, false),
      taxMinor: safeMinor(line.taxMinor, true),
    });
  });
}

function safeMinor(value: unknown, zero: boolean): number {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('INVOICE_AMOUNT_INVALID');
  const amount = BigInt(value);
  if ((!zero && amount === 0n) || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('INVOICE_AMOUNT_INVALID');
  return Number(amount);
}

function hex(value: unknown, code: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new Error(code);
  return value;
}
<<<<<<< HEAD
=======
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
