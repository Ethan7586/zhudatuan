import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { defineModule } from '../../composition/DefinedModule';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { VERIFICATION_CHANNEL_PORT } from '../notification/public';
import { VERIFICATION_VOUCHER_PORT } from '../voucher/public';
import { ChallengesIssueHandler } from './application/handler/ChallengesIssueHandler';
import { ChallengesVerifyHandler } from './application/handler/ChallengesVerifyHandler';
import { DevicesManageHandler } from './application/handler/DevicesManageHandler';
import { DevicesReadHandler } from './application/handler/DevicesReadHandler';
import { HistoryReadHandler } from './application/handler/HistoryReadHandler';
import { SessionsReadHandler } from './application/handler/SessionsReadHandler';
import { PgAttemptRepository } from './infrastructure/persistence/PgAttemptRepository';
import { PgChallengeRepository } from './infrastructure/persistence/PgChallengeRepository';
import { PgDeviceRepository } from './infrastructure/persistence/PgDeviceRepository';
import { PgSessionRepository } from './infrastructure/persistence/PgSessionRepository';
import { PgVerificationPort } from './infrastructure/persistence/PgVerificationPort';
import { Manifest } from './Manifest';
import { VERIFICATION_PORT } from './public';
import { RUNTIME_VERIFICATION_PORT } from './public';
import { PgVerificationRetentionPort } from './infrastructure/persistence/PgVerificationRetentionPort';

export const VerificationModule = defineModule(Manifest, {
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const members = context.ports.get(MEMBER_ACCESS_PORT);
    const organizations = context.ports.get(ORGANIZATION_READ_PORT);
    const challenges = new PgChallengeRepository(transactions, members, organizations, context.ports.get(VERIFICATION_VOUCHER_PORT), context.ports.get(VERIFICATION_CHANNEL_PORT));
    const sessions = new PgSessionRepository(transactions, members);
    const attempts = new PgAttemptRepository(transactions, organizations);
    const devices = new PgDeviceRepository(transactions);
    return [new SessionsReadHandler(sessions), new ChallengesIssueHandler(challenges), new ChallengesVerifyHandler(challenges), new HistoryReadHandler(attempts), new DevicesReadHandler(devices), new DevicesManageHandler(devices)];
  },
  ports: [{ token: VERIFICATION_PORT, value: new PgVerificationPort() }],
  jobPorts: [{ token: RUNTIME_VERIFICATION_PORT, value: new PgVerificationRetentionPort() }],
});
