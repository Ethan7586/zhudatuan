import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { TaskAuthorizationPort } from '../../../access/public/TaskAuthorizationPort';
import type { ImportBatchFactoryPort, ImportPort, JobPort } from '../../../runtime/public';
import type { ImportProcessPort } from '../../application/port/ImportProcessPort';
import type { OrderImportRepository } from '../../application/port/OrderImportRepository';

export function createImportProcess(factory: ImportBatchFactoryPort, manager: TransactionManager, runtime: ImportPort, jobs: JobPort, orders: OrderImportRepository, authorization: TaskAuthorizationPort): ImportProcessPort {
  return factory.create({
    owner: 'order',
    failure: 'ORDER_IMPORT_ROW_FAILED',
    transactions: manager,
    runtime,
    authorization,
    write: (context, target, row, value) => orders.import(context, target, row, value),
    continue: (context, target, sequence) =>
      jobs
        .create(context, {
          idempotency: `${target.id}:${sequence}`,
          kind: 'orderimport',
          owner: 'order',
          scope: target.scope,
          queue: 'import',
          payload: Object.freeze({ import: target.id }),
          actor: 'system:order',
        })
        .then(() => undefined),
  });
}
