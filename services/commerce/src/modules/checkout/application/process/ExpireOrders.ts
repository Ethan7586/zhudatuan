import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { OrderExpiryInventoryPort } from '../../../inventory/public';
import type { OrderExpiryPort } from '../../../order/public';
import type { OrderExpiryPaymentPort, PaymentHoldReleasePort } from '../../../payment/public';
import type { OrderExpiryCheckoutPort } from '../../public';
import type { OrderExpiryRepository } from '../port/OrderExpiryRepository';
import { quoteHash } from '../../domain/service/QuoteSigner';

export interface OrderExpiryDependencies {
  readonly payments: OrderExpiryPaymentPort;
  readonly checkouts: OrderExpiryCheckoutPort;
  readonly inventory: OrderExpiryInventoryPort;
  readonly orders: OrderExpiryPort;
  readonly holds: PaymentHoldReleasePort;
}

export interface OrderExpiryRequest {
  readonly checkout: string | null;
  readonly order: string | null;
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class ExpireOrders {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: OrderExpiryRepository,
    private readonly dependencies: OrderExpiryDependencies
  ) {}

  async execute(request: OrderExpiryRequest): Promise<void> {
    await this.transactions.write(
      {
        tenant: request.scope,
        membership: '',
        scope: request.scope,
        actor: 'job:orderexpiry',
        trace: request.trace,
        operation: 'job.order.expiry',
        workload: 'jobs',
        signal: request.signal,
        deadline: request.deadline,
      },
      async (context) => {
        const receipt = quoteHash({ checkout: request.checkout, order: request.order, trace: request.checkout === null && request.order === null ? request.trace : null, scope: request.scope });
        if (!(await this.repository.claim(context, receipt, request.scope))) return;
        const expired = await this.dependencies.checkouts.expire(context, request.checkout);
        for (const item of expired) await this.dependencies.inventory.expireCheckout(context, item.id);
        const expirations = await this.dependencies.payments.expirations(context, request.order);
        const orders = await this.dependencies.orders.expirable(context, [...new Set(expirations.map((target) => target.order))]);
        const allowed = new Map(orders.map((target) => [target.id, target]));
        for (const target of expirations.filter(({ external, order }) => external && allowed.has(order))) {
          await this.repository.schedulePaymentQuery(context, target.intent, allowed.get(target.order)!.scope);
        }
        const internal = new Set(expirations.filter(({ external, order }) => !external && allowed.has(order)).map(({ order }) => order));
        for (const id of [...internal].sort()) {
          const expiredOrder = allowed.get(id)!;
          await this.dependencies.orders.cancelUnpaid(context, expiredOrder.id);
          await this.dependencies.holds.release(context, expiredOrder.id);
          await this.repository.recordCancellation(context, expiredOrder.id, expiredOrder.scope, request.trace);
        }
        await this.dependencies.payments.expire(context, request.order);
      }
    );
  }
}
