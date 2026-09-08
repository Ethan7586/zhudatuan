import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { TaskAuthorizationPort } from '../../../access/public/TaskAuthorizationPort';
import type { ImportBatchFactoryPort, ImportPort, JobPort } from '../../../runtime/public';
import type { InventoryImportRepository } from '../../application/port/InventoryImportRepository';
import type { ImportProcessPort } from '../../application/port/ImportProcessPort';

export function createImportProcess(factory: ImportBatchFactoryPort, manager: TransactionManager, runtime: ImportPort, jobs: JobPort, inventory: InventoryImportRepository, authorization: TaskAuthorizationPort): ImportProcessPort {
  return factory.create({
    owner: 'inventory',
    failure: 'INVENTORY_IMPORT_ROW_FAILED',
    transactions: manager,
    runtime,
    authorization,
    write: (context, target, row, value) => inventory.import(context, target.scope, target.id, row, value),
    continue: (context, target, sequence) =>
      jobs
        .create(context, {
          idempotency: `${target.id}:${sequence}`,
          kind: 'inventoryimport',
          owner: 'inventory',
          scope: target.scope,
          queue: 'import',
          payload: Object.freeze({ import: target.id }),
          actor: 'system:inventory',
        })
        .then(() => undefined),
  });
}
