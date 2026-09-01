import { PgOutbox } from '../../../../adapter/database/PgOutbox';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import { SystemClock } from '../../../../foundation/domain/Clock';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { WriteDatabaseWorkload } from '../../../../foundation/persistence/Workload';
import { ReceiveOrder } from './ReceiveOrder';
import type { ReceiveOrderInput, ReceiveOrderOutput } from '../../public/OrderReceiptPort';
import type { OrderReceiptPort } from '../../public/OrderReceiptPort';
export class PgOrderReceiptPort implements OrderReceiptPort {
  private readonly transactions: PgTransactionManager;
  private readonly command: ReceiveOrder;
  constructor(
    pool: DatabasePool,
    private readonly workload: WriteDatabaseWorkload = 'command'
  ) {
    this.transactions = new PgTransactionManager(pool);
    this.command = new ReceiveOrder(new PgTransactionAccess(), new PgOutbox(this.transactions), SystemClock);
  }
  receive(input: ReceiveOrderInput): Promise<Readonly<ReceiveOrderOutput>> {
    const deadline = Date.now() + 15_000;
    const signal = AbortSignal.timeout(15_000);
    return this.transactions.write(
      { tenant: input.scopeId, membership: input.membershipId, scope: input.scopeId, actor: input.actorId, trace: input.traceId, operation: 'order.orders.receive', workload: this.workload === 'worker' ? 'jobs' : 'api', deadline, signal },
      (transaction) => this.command.execute(transaction, input)
    );
  }
}
