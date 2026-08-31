import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { workerTransaction } from '../../../../foundation/infrastructure/WorkerDatabase';
import type { InvoiceIssuer } from '../../application/port/InvoiceIssuer';

export class InvoiceJobProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly objects: ObjectStore,
    private readonly kms: KmsClient,
    private readonly issuer: InvoiceIssuer
  ) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'invoice') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
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
  }
}

interface InvoiceRow {
  readonly id: string;
  readonly owner_id: string;
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
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
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
