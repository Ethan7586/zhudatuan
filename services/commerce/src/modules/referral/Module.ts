import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { defineModule } from '../../composition/DefinedModule';
import { SECURITY_KEYS } from '../../platform/secret/SecretStore';
import { APPROVAL_PORT } from '../approval/public';
import { REFERRAL_CATALOG_PORT } from '../catalog/public';
import { REFERRAL_MEMBER_PORT } from '../member/public';
import { BindingsCreateHandler } from './application/handler/BindingsCreateHandler';
import { BindingsReadHandler } from './application/handler/BindingsReadHandler';
import { CommissionsReadHandler } from './application/handler/CommissionsReadHandler';
import { EarningsReadHandler } from './application/handler/EarningsReadHandler';
import { LinksReadHandler } from './application/handler/LinksReadHandler';
import { MembersApplyHandler } from './application/handler/MembersApplyHandler';
import { MembersApproveHandler } from './application/handler/MembersApproveHandler';
import { MembersDisqualifyHandler } from './application/handler/MembersDisqualifyHandler';
import { MembersReadHandler } from './application/handler/MembersReadHandler';
import { ProductsManageHandler } from './application/handler/ProductsManageHandler';
import { ProductsReadHandler } from './application/handler/ProductsReadHandler';
import { SettingsManageHandler } from './application/handler/SettingsManageHandler';
import { SettingsReadHandler } from './application/handler/SettingsReadHandler';
import { WithdrawalsCreateHandler } from './application/handler/WithdrawalsCreateHandler';
import { WithdrawalsReadHandler } from './application/handler/WithdrawalsReadHandler';
import { SystemClock } from './application/port/Clock';
import { UuidIdentifier } from './application/port/Identifier';
import { ReferralToken } from './domain/value/ReferralToken';
import { PgCommissionRepository } from './infrastructure/persistence/PgCommissionRepository';
import { PgReferralReadPort } from './infrastructure/persistence/PgReferralReadPort';
import { PgReferralRepository } from './infrastructure/persistence/PgReferralRepository';
import { PgReferralWritePort } from './infrastructure/persistence/PgReferralWritePort';
import { PgWithdrawalRepository } from './infrastructure/persistence/PgWithdrawalRepository';
import { Manifest } from './Manifest';
import { REFERRAL_READ_PORT, REFERRAL_WRITE_PORT } from './public';
import { createJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';
import { RequestWithdrawalApproval } from './application/service/RequestWithdrawalApproval';

export const ReferralModule = defineModule(Manifest, {
  jobs: createJobs,
  events: [{ handler: 'referralevent', events: EVENT_SUBSCRIPTIONS.referralevent }],
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const referrals = new PgReferralRepository(transactions, context.ports.get(REFERRAL_MEMBER_PORT));
    const commissions = new PgCommissionRepository(transactions);
    const withdrawals = new PgWithdrawalRepository(transactions);
    const tokens = new ReferralToken(context.service(SECURITY_KEYS).quote);
    return [
      new SettingsReadHandler(referrals),
      new SettingsManageHandler(referrals),
      new ProductsReadHandler(referrals),
      new ProductsManageHandler(referrals, context.ports.get(REFERRAL_CATALOG_PORT)),
      new MembersReadHandler(referrals),
      new MembersApplyHandler(referrals, UuidIdentifier),
      new MembersApproveHandler(referrals),
      new MembersDisqualifyHandler(referrals),
      new BindingsReadHandler(referrals),
      new BindingsCreateHandler(referrals, UuidIdentifier, tokens, new SystemClock()),
      new CommissionsReadHandler(commissions),
      new EarningsReadHandler(referrals, commissions),
      new LinksReadHandler(referrals, tokens, new SystemClock()),
      new WithdrawalsReadHandler(referrals, withdrawals),
      new WithdrawalsCreateHandler(referrals, withdrawals, UuidIdentifier, new RequestWithdrawalApproval(context.ports.get(APPROVAL_PORT))),
    ];
  },
  ports: (context) => {
    const transactions = new PgTransactionAccess();
    const referrals = new PgReferralRepository(transactions, context.ports.get(REFERRAL_MEMBER_PORT));
    return [
      { token: REFERRAL_READ_PORT, value: new PgReferralReadPort(transactions) },
      { token: REFERRAL_WRITE_PORT, value: new PgReferralWritePort(referrals) },
    ];
  },
});
