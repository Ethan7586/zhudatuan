import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { KmsClient } from '../../../foundation/application/KmsPort';
import type { ObjectStore, ObjectUpload, StoredObject } from '../../runtime/public/ObjectPort';
import { result, transactionManager } from '../../../test/TransactionFixture';
import type { InvoiceIssuer } from '../application/port/InvoiceIssuer';
import type { PayoutGateway } from '../application/port/PayoutGateway';
import { IssueInvoice } from '../application/process/IssueInvoice';
import { RunSettlement } from '../application/process/RunSettlement';
import { PgInvoiceProcess } from '../infrastructure/persistence/PgInvoiceProcess';
import { PgSettlementProcess } from '../infrastructure/persistence/PgSettlementProcess';
import type { FinanceOrderPort } from '../../order/public';
import type { FinancePaymentPort } from '../../payment/public';

const execution = Object.freeze({ scope: 'mall:one', trace: 'job:one', signal: new AbortController().signal,
  deadline: Date.now() + 10_000 });

describe('finance external-success recovery', () => {
  it('returns the same frozen settlement batch on a retry without reinserting it', async () => {
    let settlement: Record<string, unknown> | undefined;
    let inserts = 0;
    let sourceReads = 0;
    const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('pg_advisory_xact_lock')) return result([]);
      if (sql.includes('from finance.reconciliation reconciliation') && sql.includes('for update of reconciliation')) {
        sourceReads += 1;
        return result([{ scope_id: 'mall:one', partner_id: 'partner:one', period: '2026-09', credit_minor: 100,
          created_by: 'membership:maker', statement_hash: 'a'.repeat(64), version: 2,
          updated_at: '2026-09-06T00:00:00.000Z', rule: null, rule_text: '{}' }]);
      }
      if (sql.includes('from finance.reconciliationitem item join finance.statementline'))
        return result([{ id: 'item:one', internal_type: 'payment', internal_id: 'payment:one', internal_minor: 100,
          version: 1, external_reference: 'transaction:one', kind: 'payment', tax_minor: 6, raw_hash: 'b'.repeat(64) }]);
      if (sql.includes('from finance.settlement where reconciliation_id')) return result(settlement ? [settlement] : []);
      if (sql.includes('insert into finance.settlement(')) {
        inserts += 1;
        settlement = { id: values[0], partner_id: values[1], period: values[2], reconciliation_id: values[3],
          amount_minor: values[4], scope_id: values[5], currency: 'CNY', gross_minor: values[9], fee_minor: values[10],
          invoice_basis: values[11], input_hash: values[12], input_count: values[13], input_minor: values[9], input_watermark: values[14] };
        return result([settlement]);
      }
      if (sql.includes('line_count') && sql.includes('current_gross'))
        return result([{ line_count: 1, line_total: 100, split_total: 100, current_gross: 100 }]);
      return result([]);
    });
    const unusedPayout = { submit: vi.fn() } as unknown as PayoutGateway;
    const process = new RunSettlement(new PgSettlementProcess(transactionManager(query), unusedPayout, paymentOrders(), verifiedOrders()));

    await process.settle('reconciliation:one', execution);
    const first = { ...settlement };
    await process.settle('reconciliation:one', execution);

    expect(inserts).toBe(1);
    expect(sourceReads).toBe(1);
    expect(settlement).toEqual(first);
    expect(settlement).toMatchObject({ id: 'settlement:reconciliation:one', input_hash: expect.stringMatching(/^[a-f0-9]{64}$/), input_count: 1 });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('update finance.settlementline'))).toBe(false);
  });

  it('reuses the same payout number and frozen hash after local posting fails', async () => {
    let state = 'approved';
    let requestHash: string | null = null;
    let failPosting = true;
    const submitted: unknown[] = [];
    const payout: PayoutGateway = {
      submit: vi.fn(async (input) => {
        submitted.push(input);
        return { provider: 'bank', reference: 'bank:withdrawal:one', state: 'paid' as const };
      }),
    };
    const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('pg_advisory_xact_lock')) return result([]);
      if (sql.includes('from finance.withdrawal where id=$1 for update')) return result([withdrawal(state, requestHash)]);
      if (sql.includes("update finance.withdrawal set state='processing'")) {
        state = 'processing';
        requestHash = String(values[1]);
        return result([withdrawal(state, requestHash)]);
      }
      if (sql.includes('from finance.withdrawal withdrawal') && sql.includes('for update of withdrawal'))
        return result([{ scope_id: 'mall:one', settlement_id: 'settlement:one', partner_id: 'partner:one',
          amount_minor: 100, currency: 'CNY', provider: null, provider_reference: null }]);
      if (sql.includes('select finance.post')) {
        if (failPosting) { failPosting = false; throw new Error('LOCAL_POST_FAILED'); }
        return result([{ journal: 'journal:withdrawal:one' }]);
      }
      if (sql.includes('select 1 from finance.economicleg')) return result([{ exists: 1 }]);
      if (sql.includes("update finance.withdrawal set state='paid'")) { state = 'paid'; return result([{ id: 'withdrawal:one' }]); }
      return result([]);
    });
    const process = new RunSettlement(new PgSettlementProcess(transactionManager(query), payout, paymentOrders(), verifiedOrders()));

    await expect(process.withdraw('withdrawal:one', execution)).rejects.toThrow('LOCAL_POST_FAILED');
    await expect(process.withdraw('withdrawal:one', execution)).resolves.toBeUndefined();

    expect(state).toBe('paid');
    expect(submitted).toHaveLength(2);
    expect(submitted[1]).toEqual(submitted[0]);
    expect(submitted[0]).toMatchObject({ withdrawal: 'withdrawal:one', inputHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });

  it('reuses an uploaded invoice document after external issue succeeds but the local receipt fails', async () => {
    let state = 'approved';
    let version = 1;
    let issueHash: string | null = null;
    let issueCount: number | null = null;
    let failReceipt = true;
    let document: Record<string, unknown> | undefined;
    const issued = Object.freeze({ externalId: 'tax:invoice:one', provider: 'tax',
      document: new TextEncoder().encode('%PDF-invoice-one'), contentType: 'application/pdf' as const });
    const issuer = { issue: vi.fn<InvoiceIssuer['issue']>(async () => issued) };
    const objects = new MemoryInvoiceObjects();
    const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('pg_advisory_xact_lock')) return result([]);
      if (sql.includes('from invoice.request request join invoice.requestprofile'))
        return result([invoice(state, version, issueHash, issueCount)]);
      if (sql.includes('from invoice.line where request_id'))
        return result([{ id: '1', description: '商品', amount_minor: 100, tax_minor: 6 }]);
      if (sql.includes("update invoice.request set state='issuing'")) {
        state = 'issuing'; version += 1; issueHash = String(values[1]); issueCount = Number(values[3]);
        return result([{ version, issue_hash: issueHash, issue_watermark: '2026-09-06T00:00:00.000Z' }]);
      }
      if (sql.includes('insert into invoice.document')) {
        if (failReceipt) { failReceipt = false; throw new Error('LOCAL_RECEIPT_FAILED'); }
        document = { id: values[0], provider: values[2], external_id: values[3], object_ref: values[4], sha256: values[5],
          kind: values[6], red_of_id: values[7] };
        return result([]);
      }
      if (sql.includes('select id,provider,external_id,object_ref,sha256,kind,red_of_id from invoice.document'))
        return result(document ? [document] : []);
      if (sql.includes('update invoice.request set state=$2')) { state = 'issued'; version = Number(values[2]); return result([{ id: 'invoice:one' }]); }
      return result([]);
    });
    const kms = { decrypt: vi.fn(async (_purpose, _key, ciphertext: string) => ciphertext.endsWith('title') ? '测试企业' : '91310000TEST') } as unknown as KmsClient;
    const process = new IssueInvoice(new PgInvoiceProcess(transactionManager(query), objects, kms, issuer));

    await expect(process.execute('invoice:one', execution)).rejects.toThrow('LOCAL_RECEIPT_FAILED');
    await expect(process.execute('invoice:one', execution)).resolves.toBeUndefined();

    expect(state).toBe('issued');
    expect(issuer.issue).toHaveBeenCalledTimes(2);
    expect(issuer.issue.mock.calls[1]?.[0]).toEqual(issuer.issue.mock.calls[0]?.[0]);
    expect(objects.creates).toBe(1);
  });
});

function paymentOrders(): FinancePaymentPort {
  return {
    externalAmount: async () => 0,
    reconciliation: async () => Object.freeze([]),
    orders: async (_context, payments) => Object.freeze(payments.map((payment) => Object.freeze({ payment, order: `order:${payment}` }))),
  };
}

function verifiedOrders(): FinanceOrderPort {
  return { verified: async (_context, orders) => Object.freeze([...orders]) };
}

function withdrawal(state: string, requestHash: string | null) {
  return { id: 'withdrawal:one', scope_id: 'mall:one', settlement_id: 'settlement:one', destination_ref: 'secret:bank:one',
    amount_minor: 100, currency: 'CNY', state, request_hash: requestHash,
    input_watermark: requestHash === null ? null : '2026-09-06T00:00:00.000Z', provider: null, provider_reference: null,
    created_at: '2026-09-06T00:00:00.000Z', version: state === 'approved' ? 1 : 2 };
}

function invoice(state: string, version: number, issueHash: string | null, issueCount: number | null) {
  return { id: 'invoice:one', owner_id: 'mall:one', amount_minor: 100, currency: 'CNY', profile_id: 'profile:one',
    settlement_id: 'settlement:one', kind: 'original', red_of_request_id: null, requested_by: 'membership:maker',
    approved_by: 'membership:checker', version, state, source_hash: 'a'.repeat(64), issue_hash: issueHash,
    issue_count: issueCount, issue_watermark: issueHash === null ? null : '2026-09-06T00:00:00.000Z',
    created_at: '2026-09-06T00:00:00.000Z', title_ciphertext: 'ciphertext-title', taxid_ciphertext: 'ciphertext-taxid',
    address_ciphertext: null, profile_version: 1 };
}

class MemoryInvoiceObjects implements ObjectStore {
  readonly values = new Map<string, { readonly bytes: Uint8Array; readonly object: StoredObject & { readonly contentType: string; readonly path: string; readonly retentionUntil: null; readonly lockedUntil: null } }>();
  creates = 0;
  async create(path: string, contentType: string): Promise<ObjectUpload> {
    this.creates += 1;
    let bytes = new Uint8Array();
    return { append: async (part) => { bytes = new Uint8Array([...bytes, ...part]); }, abort: async () => undefined,
      complete: async () => {
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const object = { reference: `object:${path}`, sha256, size: bytes.byteLength, scan: 'clean' as const, contentType, path,
          retentionUntil: null, lockedUntil: null };
        this.values.set(path, { bytes, object });
        return object;
      } };
  }
  async find(path: string) { return this.values.get(path)?.object ?? null; }
  async inspect(): Promise<never> { throw new Error('NOT_SUPPORTED'); }
  async lock(): Promise<never> { throw new Error('NOT_SUPPORTED'); }
  async read(): Promise<never> { throw new Error('NOT_SUPPORTED'); }
  async *chunks(): AsyncIterable<Uint8Array> { throw new Error('NOT_SUPPORTED'); }
  async remove(): Promise<void> { throw new Error('NOT_SUPPORTED'); }
  async authorize(): Promise<never> { throw new Error('NOT_SUPPORTED'); }
  async authorizeUpload(): Promise<never> { throw new Error('NOT_SUPPORTED'); }
}
