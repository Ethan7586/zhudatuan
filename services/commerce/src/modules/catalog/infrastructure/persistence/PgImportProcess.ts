import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { TaskAuthorizationPort } from '../../../access/public/TaskAuthorizationPort';
import type { ImportBatchFactoryPort, ImportPort, JobPort } from '../../../runtime/public';
import type { CatalogImportRepository } from '../../application/port/CatalogImportRepository';
import type { ImportProcessPort } from '../../application/port/ImportProcessPort';

export function createImportProcess(factory: ImportBatchFactoryPort, manager: TransactionManager, runtime: ImportPort, jobs: JobPort,
  catalog: CatalogImportRepository, authorization: TaskAuthorizationPort): ImportProcessPort {
  return factory.create({
    owner: 'catalog', failure: 'CATALOG_IMPORT_ROW_FAILED', transactions: manager, runtime, authorization,
    prepare: (target, rows, execution) => manager.read(importOptions(target, execution),
      (context) => catalog.prepare(context, target.scope, rows)),
    write: (context, target, row, value) => catalog.import(context, target, row, value),
    continue: (context, target, sequence) => jobs.create(context, {
      idempotency: `${target.id}:${sequence}`, kind: 'catalogimport', owner: 'catalog', scope: target.scope, queue: 'import',
      payload: Object.freeze({ import: target.id }), actor: 'system:catalog',
    }).then(() => undefined),
    publish: (target, report, execution) => manager.write(importOptions(target, execution), async (context) => {
      const progress = await runtime.progress(context, target.id, 'catalog');
      if (!progress) throw new Error('CATALOG_IMPORT_PROGRESS_MISSING');
      await runtime.complete(context, target.id, 'catalog', report);
      if (progress.failed === 0) await catalog.release(context, target.id, target.scope);
    }),
  });
}

function importOptions(target: Readonly<{ id: string; scope: string }>, execution: Readonly<{ signal: AbortSignal; deadline: number }>) {
  return { tenant: target.scope, membership: '', scope: target.scope, actor: 'job:catalogimport', trace: target.id,
    operation: 'job.catalog.import.preflight', workload: 'jobs' as const, signal: execution.signal, deadline: execution.deadline };
}
