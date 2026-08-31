import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../../foundation/application/ModuleOperations';
import { SECURITY_KEYS } from '../../../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { REFERRAL_CATALOG_PORT } from '../../../catalog/public';
import { REFERRAL_MEMBER_PORT } from '../../../member/public';
import { referralCommands } from '../../application/command/ManageReferral';
import { UuidIdentifier } from '../../application/port/Identifier';
import { SystemClock } from '../../application/port/Clock';
import { referralQueries } from '../../application/query/ReadReferral';
import { ReferralToken } from '../../domain/value/ReferralToken';
import { PgReferralRepository } from '../../infrastructure/persistence/PgReferralRepository';
import { PgCommissionRepository } from '../../infrastructure/persistence/PgCommissionRepository';
import { PgWithdrawalRepository } from '../../infrastructure/persistence/PgWithdrawalRepository';
import type { Transaction } from '../../../../foundation/persistence/UnitOfWork';

export function referralRoutes(context: ModuleContext): ModuleOperations {
  const tokens = new ReferralToken(context.service(SECURITY_KEYS).quote);
  const members = context.ports.get(REFERRAL_MEMBER_PORT);
  const repositories = Object.freeze({
    referral: (transaction: Transaction) => new PgReferralRepository(transaction),
    commissions: (transaction: Transaction) => new PgCommissionRepository(transaction),
    withdrawals: (transaction: Transaction) => new PgWithdrawalRepository(transaction),
  });
  return new ModuleOperations('referral', context.service(DATABASE_POOL), context.service(AUDIT_SINK), {
    ...referralQueries(tokens, SystemClock, members, repositories),
    ...referralCommands({ members, catalog: context.ports.get(REFERRAL_CATALOG_PORT), identifiers: UuidIdentifier, tokens, clock: SystemClock, referral: repositories.referral, withdrawals: repositories.withdrawals }),
  });
}
