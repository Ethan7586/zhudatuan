import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { PgTransactionManager } from '../../adapter/database/PgTransactionManager';
import { PgTransactionalOutbox } from '../../adapter/database/PgTransactionalOutbox';
import { defineModule } from '../../bootstrap/DefinedModule';
import { InstancesGetHandler } from './application/handler/InstancesGetHandler';
import { TasksApproveHandler } from './application/handler/TasksApproveHandler';
import { TasksListHandler } from './application/handler/TasksListHandler';
import { TasksRejectHandler } from './application/handler/TasksRejectHandler';
import { TemplatesCreateHandler } from './application/handler/TemplatesCreateHandler';
import { TemplatesDisableHandler } from './application/handler/TemplatesDisableHandler';
import { TemplatesEnableHandler } from './application/handler/TemplatesEnableHandler';
import { TemplatesGetHandler } from './application/handler/TemplatesGetHandler';
import { TemplatesListHandler } from './application/handler/TemplatesListHandler';
import { TemplatesReviseHandler } from './application/handler/TemplatesReviseHandler';
import { ApprovalApplication } from './application/service/ApprovalApplication';
import { EscalateApproval } from './application/process/EscalateApproval';
import { PgApprovalPort } from './infrastructure/persistence/PgApprovalPort';
import { PgApprovalReadPort } from './infrastructure/persistence/PgApprovalReadPort';
import { PgApprovalRepository } from './infrastructure/persistence/PgApprovalRepository';
import { createJobs } from './interface/job/JobFactory';
import { Manifest } from './Manifest';
import { APPROVAL_PORT, APPROVAL_READ_PORT } from './public';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export const ApprovalModule = defineModule(Manifest, {
  handlers: () => {
    const repository = new PgApprovalRepository(new PgTransactionAccess());
    const application = new ApprovalApplication(repository);
    return [
      new TemplatesListHandler(application),
      new TemplatesGetHandler(application),
      new TemplatesCreateHandler(application),
      new TemplatesReviseHandler(application),
      new TemplatesEnableHandler(application),
      new TemplatesDisableHandler(application),
      new TasksListHandler(application),
      new TasksApproveHandler(application),
      new TasksRejectHandler(application),
      new InstancesGetHandler(application),
    ];
  },
  ports: approvalPorts,
  jobPorts: approvalPorts,
  jobs: (context) => {
    const access = new PgTransactionAccess();
    return createJobs(new EscalateApproval(new PgTransactionManager(context.service(DATABASE_POOL)), new PgApprovalRepository(access), new PgTransactionalOutbox(access)));
  },
});

function approvalPorts() {
  const access = new PgTransactionAccess();
  const repository = new PgApprovalRepository(access);
  return Object.freeze([
    { token: APPROVAL_PORT, value: new PgApprovalPort(repository, new PgTransactionalOutbox(access)) },
    { token: APPROVAL_READ_PORT, value: new PgApprovalReadPort(repository) },
  ]);
}
