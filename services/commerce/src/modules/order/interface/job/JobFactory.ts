import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { ORDER_IMPORT_FINANCE_PORT } from '../../../finance/public';
import { MEMBER_READ_PORT } from '../../../member/public';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';
import { ORDER_IMPORT_PAYMENT_PORT } from '../../../payment/public';
import { IMPORT_BATCH_FACTORY_PORT, IMPORT_RUNNER_PORT, JOB_PORT, RUNTIME_IMPORT_PORT } from '../../../runtime/public';
import { OrderImportProcess } from '../../application/process/OrderImportProcess';
import { ProcessOrderEvent } from '../../application/process/ProcessOrderEvent';
import { createImportProcess } from '../../infrastructure/persistence/PgImportProcess';
import { PgOrderEventProcess } from '../../infrastructure/persistence/PgOrderEventProcess';
import { PgOrderImportRepository } from '../../infrastructure/persistence/PgOrderImportRepository';
import { OrderEventJob } from './OrderEventJob';
import { OrderImportJob } from './OrderImportJob';
import { TASK_AUTHORIZATION_PORT } from '../../../access/public';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const manager = new PgTransactionManager(context.service(DATABASE_POOL));
  const repository = new PgOrderImportRepository({
    organizations: context.ports.get(ORGANIZATION_READ_PORT),
    members: context.ports.get(MEMBER_READ_PORT),
    payments: context.ports.get(ORDER_IMPORT_PAYMENT_PORT),
    finance: context.ports.get(ORDER_IMPORT_FINANCE_PORT),
  });
  const process = new OrderImportProcess(
    context.ports.get(IMPORT_RUNNER_PORT),
    createImportProcess(context.ports.get(IMPORT_BATCH_FACTORY_PORT), manager, context.ports.get(RUNTIME_IMPORT_PORT), context.ports.get(JOB_PORT), repository, context.ports.get(TASK_AUTHORIZATION_PORT))
  );
  return Object.freeze([
    { id: 'orderimport', processor: new OrderImportJob(process) },
    { id: 'orderevent', processor: new OrderEventJob(new ProcessOrderEvent(new PgOrderEventProcess(manager))) },
  ]);
}
