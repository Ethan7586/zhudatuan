import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { defineModule } from '../../bootstrap/DefinedModule';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { VERIFICATION_VOUCHER_PORT } from '../voucher/public';
import { ChallengesIssueHandler } from './application/handler/ChallengesIssueHandler';
import { ChallengesVerifyHandler } from './application/handler/ChallengesVerifyHandler';
import { DevicesManageHandler } from './application/handler/DevicesManageHandler';
import { DevicesReadHandler } from './application/handler/DevicesReadHandler';
import { HistoryReadHandler } from './application/handler/HistoryReadHandler';
import { SessionsReadHandler } from './application/handler/SessionsReadHandler';
import { PgVerificationRepository } from './infrastructure/persistence/PgVerificationRepository';
import { Manifest } from './Manifest';

export const VerificationModule = defineModule(Manifest, {
  handlers: (context) => {
    const repository = new PgVerificationRepository(new PgTransactionAccess(), context.ports.get(MEMBER_ACCESS_PORT), context.ports.get(ORGANIZATION_READ_PORT), context.ports.get(VERIFICATION_VOUCHER_PORT));
    return [new SessionsReadHandler(repository), new ChallengesIssueHandler(repository), new ChallengesVerifyHandler(repository), new HistoryReadHandler(repository), new DevicesReadHandler(repository), new DevicesManageHandler(repository)];
  },
});
