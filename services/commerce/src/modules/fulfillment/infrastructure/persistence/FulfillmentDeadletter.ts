import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ClaimedJob, JobDeadletter } from '../../../runtime/public/JobProcess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgFulfillmentSaga } from './PgFulfillmentSaga';

export class FulfillmentDeadletter implements JobDeadletter {
  private readonly access = new PgTransactionAccess();
  private readonly saga = new PgFulfillmentSaga();

  async record(context: WriteTransactionContext, job: ClaimedJob, error: string): Promise<void> {
    const payload = record(job.payload);
    const fulfillment = text(payload.fulfillment);
    if (!fulfillment) return;
    await this.saga.takeover(this.access.database(context), fulfillment, job.kind, error);
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
