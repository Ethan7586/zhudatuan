import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { FinanceChannelPort } from '../../../channel/public';
import type { FinanceFulfillmentPort } from '../../../fulfillment/public';
import type { FinancePaymentPort } from '../../../payment/public';
import type { ReconciliationProcess } from '../../application/port/ReconciliationProcess';
import { PostJournal } from './JournalPosting';
import { ReconcileStatement } from './ReconciliationActions';

export interface ReconciliationDependencies {
  readonly channel: FinanceChannelPort;
  readonly fulfillments: FinanceFulfillmentPort;
  readonly payments: FinancePaymentPort;
}

export class PgReconciliationProcess implements ReconciliationProcess {
  private readonly posting: PostJournal;
  private readonly reconciliation: ReconcileStatement;

  constructor(transactions: TransactionManager, objects: ObjectStore, dependencies: ReconciliationDependencies) {
    this.posting = new PostJournal(transactions, dependencies.payments);
    this.reconciliation = new ReconcileStatement(transactions, objects, dependencies.channel, dependencies.payments, dependencies.fulfillments);
  }

  post(event: Readonly<Record<string, unknown>>, signal: AbortSignal, deadline: number): Promise<void> {
    return this.posting.execute(event, signal, deadline);
  }

  reconcile(reconciliation: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    return this.reconciliation.execute(reconciliation, scope, signal, deadline);
  }
}
