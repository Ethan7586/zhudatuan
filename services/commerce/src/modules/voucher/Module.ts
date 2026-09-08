import { defineModule } from '../../composition/DefinedModule';
import { PgTransactionManager } from '../../platform/database/PgTransactionManager';
import { KMS_CLIENT } from '../../pipeline/KmsPort';
import { DATABASE_POOL } from '../../platform/database/Pool';
import { OBJECT_STORE } from '../runtime/public/ObjectPort';
import { MEMBER_ACCESS_PORT, TASK_AUTHORIZATION_PORT } from '../access/public';
import { APPROVAL_PORT, APPROVAL_READ_PORT } from '../approval/public';
import { EXPORT_PORT, IMPORT_OBJECT_PORT, JOB_PORT, RUNTIME_IMPORT_PORT } from '../runtime/public';
import { ExportsGetHandler } from './application/handler/ExportsGetHandler';
import { VOUCHER_ACCOUNTING_PORT } from '../finance/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { VOUCHER_CUSTOMER_PORT } from '../partner/public';
import { CHECKOUT_QUALIFICATION_PORT } from '../qualification/public';
import { createVoucherHandlers } from './application/service/OperationAssembly';
import { VoucherApplication } from './application/service/VoucherApplication';
import { VoucherActivation } from './application/service/VoucherActivation';
import { PreparedVoucherSearch } from './application/service/PreparedVoucherSearch';
import { EnvelopeCredentialProtector } from './infrastructure/crypto/EnvelopeCredentialProtector';
import { PgVoucherExport } from './infrastructure/persistence/PgVoucherExport';
import { PgActionBatchRepository } from './infrastructure/persistence/PgActionBatchRepository';
import { PgActivationRate } from './infrastructure/persistence/PgActivationRate';
import { PgCredentialPoolRepository } from './infrastructure/persistence/PgCredentialPoolRepository';
import { PgCredentialRepository } from './infrastructure/persistence/PgCredentialRepository';
import { PgIssueOrderRepository } from './infrastructure/persistence/PgIssueOrderRepository';
import { PgStockRequestRepository } from './infrastructure/persistence/PgStockRequestRepository';
import { PgTenderRepository } from './infrastructure/persistence/PgTenderRepository';
import { PgVoucherProductRepository } from './infrastructure/persistence/PgVoucherProductRepository';
import { PgVoucherRepository } from './infrastructure/persistence/PgVoucherRepository';
import { VoucherProductReference } from './infrastructure/persistence/VoucherProductReference';
import { PgVoucherSearch } from './infrastructure/persistence/PgVoucherSearch';
import { VoucherPort } from './infrastructure/persistence/VoucherPort';
import { Manifest } from './Manifest';
import { CHECKOUT_VOUCHER_PORT, FULFILLMENT_VOUCHER_PORT, PAYMENT_VOUCHER_PORT, VERIFICATION_VOUCHER_PORT } from './public';
import { createJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';

export const VoucherModule = defineModule(Manifest, {
  handlers: (context) => {
    const protector = new EnvelopeCredentialProtector(context.service(KMS_CLIENT));
    const finance = context.ports.get(VOUCHER_ACCOUNTING_PORT);
    const members = context.ports.get(MEMBER_ACCESS_PORT);
    const approval = context.ports.get(APPROVAL_PORT);
    const decisions = context.ports.get(APPROVAL_READ_PORT);
    const jobs = context.ports.get(JOB_PORT);
    const exports = context.ports.get(EXPORT_PORT);
    const organizations = context.ports.get(ORGANIZATION_READ_PORT);
    const vouchers = new PgVoucherRepository(new PgActivationRate(), members, organizations, finance);
    const application = new VoucherApplication(
      members,
      new PgVoucherProductRepository(new VoucherProductReference(context.ports.get(VOUCHER_CUSTOMER_PORT), context.ports.get(CHECKOUT_QUALIFICATION_PORT))),
      new PgCredentialPoolRepository(),
      new PgCredentialRepository(jobs, context.ports.get(RUNTIME_IMPORT_PORT), exports, context.ports.get(IMPORT_OBJECT_PORT)),
      new PgStockRequestRepository(approval, decisions),
      new PgIssueOrderRepository(approval, decisions, jobs, exports),
      new PgActionBatchRepository(jobs, exports),
      vouchers,
      new PgTenderRepository(finance, organizations),
      new PreparedVoucherSearch(new PgVoucherSearch(), protector),
      new PgVoucherExport(exports, jobs),
      new VoucherActivation(vouchers, protector)
    );
    return [...createVoucherHandlers(application), new ExportsGetHandler(exports, context.service(OBJECT_STORE), context.ports.get(TASK_AUTHORIZATION_PORT), new PgTransactionManager(context.service(DATABASE_POOL)))];
  },
  jobs: createJobs,
  events: [{ handler: 'voucherissue', events: EVENT_SUBSCRIPTIONS.voucherissue }],
  ports: (context) => {
    const finance = context.ports.get(VOUCHER_ACCOUNTING_PORT);
    const organizations = context.ports.get(ORGANIZATION_READ_PORT);
    return Object.freeze([
      { token: CHECKOUT_VOUCHER_PORT, value: new VoucherPort() },
      { token: VERIFICATION_VOUCHER_PORT, value: new VoucherPort(finance, organizations) },
      { token: PAYMENT_VOUCHER_PORT, value: new VoucherPort(finance, organizations) },
    ]);
  },
  jobPorts: (context) => [{ token: PAYMENT_VOUCHER_PORT, value: new VoucherPort(context.ports.get(VOUCHER_ACCOUNTING_PORT), context.ports.get(ORGANIZATION_READ_PORT)) }],
  providerPorts: [{ token: FULFILLMENT_VOUCHER_PORT, value: new VoucherPort() }],
});
