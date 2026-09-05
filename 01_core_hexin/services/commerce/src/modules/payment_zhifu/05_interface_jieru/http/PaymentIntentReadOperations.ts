import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../../../foundation/application/OperationHandler';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { DATABASE_POOL, type DatabasePool } from '../../../../foundation/persistence/Pool';
import { ReadPaymentIntent } from '../../03_application_yingyong/queries_duqu/ReadPaymentIntent';
import { paymentTransaction } from '../../03_application_yingyong/services_fuwu/PaymentOperationSupport';
import { PgPaymentIntentReader } from '../../04_adapters_shixian/persistence_cunchu/PgPaymentIntentReader';

export function paymentIntentReadOperations(context: ModuleContext): OperationUsecase {
  const pool = context.container.get(DATABASE_POOL).workload('command');
  return {
    invoke(request) {
      if (request.type !== 'payment.intents.read') throw new Error(`OPERATION_ACTION_MISSING:${request.type}`);
      return readPaymentIntent(pool, request);
    },
  };
}

export async function readPaymentIntent(pool: DatabasePool, request: OperationRequest): Promise<OperationResult> {
  const access = requireAccess(request);
  const mall = access.mall_id;
  if (!mall) throw new Error('SCOPE_DENIED');
  const payment = request.input.path.paymentid;
  if (!payment) throw new Error('VALIDATION_FAILED:paymentid');
  return paymentTransaction(pool, request, async (database) => ({
    status: 200,
    body: await new ReadPaymentIntent(new PgPaymentIntentReader(database))
      .execute({ payment, membership: access.membership.id, mall }),
  }));
}
