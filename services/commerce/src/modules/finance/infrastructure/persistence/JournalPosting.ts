import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
/** Finance journal persistence. */
import { FinancePort } from './FinancePort';
import type { FinancePaymentPort } from '../../../payment/public';

import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';

/** Converts accepted accounting events to idempotent journals; event owners never write ledger tables. */
export class PostJournal {
  private readonly finance = new FinancePort();
  private readonly access = new PgTransactionAccess();
  constructor(
    private readonly transactions: TransactionManager,
    private readonly payments: FinancePaymentPort
  ) {}

  async execute(envelope: Readonly<Record<string, unknown>>, signal: AbortSignal, deadline: number): Promise<void> {
    const eventid = text(envelope.eventId, 'EVENT_ID_REQUIRED');
    const event = text(envelope.event, 'EVENT_TYPE_REQUIRED');
    const payload = object(envelope.payload);
    const options = { tenant: '', membership: '', scope: 'finance', actor: 'job:reconciliation', trace: eventid, operation: 'job.finance.journal', workload: 'jobs' as const, signal, deadline };
    const target = await this.transactions.read(options, (context) => new PgRuntimeWriter(this.access.database(context)).jobEventContext('job:reconciliation', eventid));
    if (!target) throw new Error('FINANCE_EVENT_CONTEXT_MISSING');
    await this.transactions.write({ ...options, tenant: target.scope, scope: target.scope }, async (context) => {
      const database = this.access.database(context);
      const runtime = new PgRuntimeWriter(database);
      if (!(await runtime.lockInbox('job:reconciliation', eventid))) {
        return;
      }
      if (event === 'payment.captured' || event === 'refund.completed') await this.payment(database, eventid, event, payload, target);
      else if (!['payment.late.detected', 'payment.autorefund.requested'].includes(event)) throw new Error('FINANCE_EVENT_UNSUPPORTED');
      if (!(await runtime.completeInbox('job:reconciliation', eventid))) throw new Error('FINANCE_INBOX_LEASE_LOST');
    });
  }

  private async payment(database: SqlExecutor, eventid: string, event: string, payload: Readonly<Record<string, unknown>>, target: Readonly<{ scope: string; receivedAt: string }>): Promise<void> {
    integer(payload.amountMinor, 'FINANCE_EVENT_AMOUNT_INVALID');
    const currency = text(payload.currency, 'FINANCE_EVENT_CURRENCY_INVALID');
    const reference = text(payload.payment ?? payload.refund, 'FINANCE_REFERENCE_REQUIRED');
    const amount = await this.payments.externalAmount(database.transaction, event === 'refund.completed' ? 'refund' : 'payment', reference);
    if (amount === 0) return;
    await this.finance.post(
      requireWriteTransaction(database.transaction),
      event === 'refund.completed'
        ? {
            scope: target.scope,
            referenceType: event,
            referenceId: reference,
            currency,
            description: 'External payment refund',
            debit: { code: 'commerce.refund', kind: 'expense' },
            credit: { code: 'cash', kind: 'asset' },
            amountMinor: amount,
            occurredAt: target.receivedAt,
            ownerEventId: eventid,
            economicLegId: 'external.refund',
          }
        : {
            scope: target.scope,
            referenceType: event,
            referenceId: reference,
            currency,
            description: 'External payment capture',
            debit: { code: 'cash', kind: 'asset' },
            credit: { code: 'commerce.clearing', kind: 'income' },
            amountMinor: amount,
            occurredAt: target.receivedAt,
            ownerEventId: eventid,
            economicLegId: 'external.capture',
          }
    );
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
function integer(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(code);
  return value as number;
}
