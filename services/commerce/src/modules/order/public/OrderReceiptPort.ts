import { publicPort } from '../../../bootstrap/ModuleRegistry';
import { PgOutbox } from '../../../adapter/database/PgOutbox';
import { PgUnitOfWork } from '../../../adapter/database/PgUnitOfWork';
import { SystemClock } from '../../../foundation/domain/Clock';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { WriteDatabaseWorkload } from '../../../foundation/persistence/Workload';
import { ReceiveOrder, type ReceiveOrderInput, type ReceiveOrderOutput } from '../application/command/ReceiveOrder';

export interface OrderReceiptPort {
  receive(input: ReceiveOrderInput): Promise<Readonly<ReceiveOrderOutput>>;
}

export const ORDER_RECEIPT_PORT = publicPort<OrderReceiptPort>('order', 'receipt');

export class PgOrderReceiptPort implements OrderReceiptPort {
  private readonly unit: PgUnitOfWork;
  private readonly command: ReceiveOrder;

  constructor(
    pool: DatabasePool,
    private readonly workload: WriteDatabaseWorkload = 'command'
  ) {
    const selected = pool.workload(workload);
    this.unit = new PgUnitOfWork(selected);
    this.command = new ReceiveOrder(new PgOutbox(selected), SystemClock);
  }

  receive(input: ReceiveOrderInput): Promise<Readonly<ReceiveOrderOutput>> {
    return this.unit.execute({ tenant: input.scopeId, membership: input.membershipId, scope: input.scopeId, actor: input.actorId, trace: input.traceId, operation: 'order.orders.receive', workload: this.workload }, (transaction) =>
      this.command.execute(transaction, input)
    );
  }
}
