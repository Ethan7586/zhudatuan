import { PgOutbox } from '../../../../platform/database/PgOutbox';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import { SystemClock } from '@shop/kernel';
import type { DatabasePool } from '../../../../platform/database/Pool';
import type { WriteDatabaseWorkload } from '../../../../platform/database/Workload';
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
    this.command = new ReceiveOrder(new PgTransactionAccess(), new PgOutbox(this.transactions), new SystemClock());
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
