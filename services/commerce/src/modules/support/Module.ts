import { defineModule } from '../../bootstrap/DefinedModule';
import { KMS_CLIENT } from '../../foundation/application/KmsPort';
import { OBJECT_STORE } from '../runtime/public/ObjectPort';
import { EVENT_REPLAY_PORT } from '../runtime/public';
import { SECRET_STORE } from '../../foundation/infrastructure/SecretStore';
import { EVENT_STREAM } from '../../foundation/stream/EventStream';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { MEMBER_READ_PORT } from '../member/public';
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
import { EventsReadHandler } from './application/handler/EventsReadHandler';
import { ReadstatesManageHandler } from './application/handler/ReadstatesManageHandler';
import { RulesManageHandler } from './application/handler/RulesManageHandler';
import { RulesReadHandler } from './application/handler/RulesReadHandler';
import { SlaManageHandler } from './application/handler/SlaManageHandler';
import { SlaReadHandler } from './application/handler/SlaReadHandler';
import { ManageAssignment } from './application/service/ManageAssignment';
import { ManageReadState } from './application/service/ManageReadState';
import { ReadSupportContext } from './application/service/ReadSupportContext';
import { SendSupportMessage } from './application/service/SendSupportMessage';
import { PgAgentRepository } from './infrastructure/persistence/PgAgentRepository';
import { PgAssignmentRepository } from './infrastructure/persistence/PgAssignmentRepository';
import { PgConversationRepository } from './infrastructure/persistence/PgConversationRepository';
import { PgEvidenceRepository } from './infrastructure/persistence/PgEvidenceRepository';
import { PgMessageRepository } from './infrastructure/persistence/PgMessageRepository';
import { PgReadStateRepository } from './infrastructure/persistence/PgReadStateRepository';
import { PgSupportConfigRepository } from './infrastructure/persistence/PgSupportConfigRepository';
import { PgSupportContextRepository } from './infrastructure/persistence/PgSupportContextRepository';
import { PgSupportEventRepository } from './infrastructure/persistence/PgSupportEventRepository';
import { PgTicketRepository } from './infrastructure/persistence/PgTicketRepository';
import { PgSupportReplayRepository } from './infrastructure/persistence/PgSupportReplayRepository';
import { RedisSupportStream } from './infrastructure/messaging/RedisSupportStream';
import { ProviderAccountVerifier } from './infrastructure/adapter/ProviderAccountVerifier';
import { SupportEventStream } from './interface/event/SupportEventStream';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';

export const SupportModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: (context) => {
    const source = new PgSupportContextRepository(
      context.ports.get(SUPPORT_ORDER_PORT),
      context.ports.get(ORGANIZATION_READ_PORT),
      context.ports.get(MEMBER_ACCESS_PORT),
      context.ports.get(SUPPORT_BENEFIT_PORT),
      context.ports.get(MEMBER_READ_PORT)
    );
    const support = new ReadSupportContext(source);
    const events = new PgSupportEventRepository();
    const agents = new PgAgentRepository(support, events);
    const configuration = new PgSupportConfigRepository(support, new ProviderAccountVerifier(context.service(SECRET_STORE)));
    const messages = new PgMessageRepository();
    const repository = new PgTicketRepository(context.service(KMS_CLIENT), support, agents, configuration, messages, events);
    const conversation = new PgConversationRepository(context.service(KMS_CLIENT), context.service(OBJECT_STORE), support);
    const evidence = new PgEvidenceRepository(context.service(OBJECT_STORE), support, repository, events);
    const sender = new SendSupportMessage(context.service(KMS_CLIENT), support, repository, conversation, messages, evidence, agents, events);
    const assignments = new ManageAssignment(support, new PgAssignmentRepository(), agents, configuration, events);
    const readstates = new ManageReadState(support, new PgReadStateRepository(), events);
    const realtime = new RedisSupportStream(context.service(EVENT_STREAM));
    const replay = new PgSupportReplayRepository(context.ports.get(EVENT_REPLAY_PORT));
    const stream = new SupportEventStream(realtime);
    return [
      new CasesCreateHandler(repository),
      new CasesReadHandler(repository),
      new CasesUpdateHandler(repository),
      new CasesCloseHandler(repository),
      new CasesReopenHandler(repository),
      new MessagesReadHandler(conversation),
      new MessagesSendHandler(sender),
      new AttachmentsCreateHandler(evidence),
      new AssignmentsManageHandler(assignments),
      new AgentsReadHandler(agents),
      new AgentsManageHandler(agents),
      new AccountsReadHandler(configuration),
      new AccountsManageHandler(configuration),
      new RulesReadHandler(configuration),
      new RulesManageHandler(configuration),
      new SlaReadHandler(configuration),
      new SlaManageHandler(configuration),
      new HistoryReadHandler(repository),
      new ReadstatesManageHandler(readstates),
      new EventsReadHandler(support, realtime, replay, stream),
    ];
  },
});
