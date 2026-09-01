import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { defineModule } from '../../bootstrap/DefinedModule';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { OBJECT_STORE } from '../../foundation/infrastructure/ObjectStore';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { SUPPORT_BENEFIT_PORT } from '../benefit/public';
import { SUPPORT_ORDER_PORT } from '../order/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { AccountsManageHandler } from './application/handler/AccountsManageHandler';
import { AccountsReadHandler } from './application/handler/AccountsReadHandler';
import { AgentsManageHandler } from './application/handler/AgentsManageHandler';
import { AgentsReadHandler } from './application/handler/AgentsReadHandler';
import { AssignmentsManageHandler } from './application/handler/AssignmentsManageHandler';
import { AttachmentsCreateHandler } from './application/handler/AttachmentsCreateHandler';
import { CasesCloseHandler } from './application/handler/CasesCloseHandler';
import { CasesCreateHandler } from './application/handler/CasesCreateHandler';
import { CasesReadHandler } from './application/handler/CasesReadHandler';
import { CasesReopenHandler } from './application/handler/CasesReopenHandler';
import { CasesUpdateHandler } from './application/handler/CasesUpdateHandler';
import { HistoryReadHandler } from './application/handler/HistoryReadHandler';
import { MessagesReadHandler } from './application/handler/MessagesReadHandler';
import { MessagesSendHandler } from './application/handler/MessagesSendHandler';
import { RulesManageHandler } from './application/handler/RulesManageHandler';
import { RulesReadHandler } from './application/handler/RulesReadHandler';
import { SlaManageHandler } from './application/handler/SlaManageHandler';
import { SlaReadHandler } from './application/handler/SlaReadHandler';
import { PgSupportUseCaseRepository } from './infrastructure/persistence/PgSupportUseCaseRepository';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';

export const SupportModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: (context) => {
    const repository = new PgSupportUseCaseRepository(
      new PgTransactionAccess(),
      context.service(KMS_CLIENT),
      context.service(OBJECT_STORE),
      context.ports.get(SUPPORT_ORDER_PORT),
      context.ports.get(ORGANIZATION_READ_PORT),
      context.ports.get(MEMBER_ACCESS_PORT),
      context.ports.get(SUPPORT_BENEFIT_PORT)
    );
    return [
      new CasesCreateHandler(repository),
      new CasesReadHandler(repository),
      new CasesUpdateHandler(repository),
      new CasesCloseHandler(repository),
      new CasesReopenHandler(repository),
      new MessagesReadHandler(repository),
      new MessagesSendHandler(repository),
      new AttachmentsCreateHandler(repository),
      new AssignmentsManageHandler(repository),
      new AgentsReadHandler(repository),
      new AgentsManageHandler(repository),
      new AccountsReadHandler(repository),
      new AccountsManageHandler(repository),
      new RulesReadHandler(repository),
      new RulesManageHandler(repository),
      new SlaReadHandler(repository),
      new SlaManageHandler(repository),
      new HistoryReadHandler(repository),
    ];
  },
});
