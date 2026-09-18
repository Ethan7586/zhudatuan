import { identityRegistrationApiAllowedOrigins, identityRegistrationApiEnvironment, identityRegistrationApiPort } from '@shop/config/server';

// This entry is the independently deployed identity runtime for each sovereign node.
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { createIdentityRegistrationApiRuntime } from '../bootstrap/IdentityRegistrationApiRuntime';
import { listen } from '../foundation/interface/NodeServer';
import {
  ACCESS_IDENTITY_OPERATOR_OPERATION_IDS,
  IdentityOperatorAccessModule,
} from '../modules/access/05_interface_jieru/IdentityOperatorAccessModule';
import { AuditModule } from '../modules/audit/05_interface_jieru/AuditModule';
import { auditManifest } from '../modules/audit/module.manifest';
import { CHANNEL_OPERATOR_READ_OPERATION_IDS } from '../modules/channel/ChannelReadOperations';
import { IdentityOperatorChannelModule } from '../modules/channel/IdentityOperatorChannelModule';
import { EXPERIENCE_OPERATOR_OPERATION_IDS } from '../modules/experience/ExperienceOperatorOperations';
import { IdentityOperatorExperienceModule } from '../modules/experience/IdentityOperatorExperienceModule';
import {
  IdentityRegistrationCoreModule,
  IdentityRegistrationModule,
} from '../modules/identity/05_interface_jieru/IdentityRegistrationModule';
import {
  IDENTITY_REGISTRATION_CORE_OPERATION_IDS,
  IDENTITY_REGISTRATION_OPERATION_IDS,
} from '../modules/identity/05_interface_jieru/http/IdentityOperations';
import { FINANCE_OPERATOR_READ_OPERATION_IDS } from '../modules/finance/FinanceReadOperations';
import { IdentityOperatorFinanceModule } from '../modules/finance/IdentityOperatorFinanceModule';
import { IdentityOperatorMemberModule, MEMBER_IDENTITY_OPERATOR_OPERATION_IDS } from '../modules/member/05_interface_jieru/IdentityOperatorMemberModule';
import { IdentityOperatorNotificationModule } from '../modules/notification/IdentityOperatorNotificationModule';
import { NOTIFICATION_OPERATOR_READ_OPERATION_IDS } from '../modules/notification/NotificationReadOperations';
import {
  IdentityOperatorQualificationModule,
  QUALIFICATION_OPERATOR_READ_OPERATION_IDS,
} from '../modules/qualification/operator';
import { IdentityOperatorReferralModule } from '../modules/referral/IdentityOperatorReferralModule';
import { REFERRAL_OPERATOR_READ_OPERATION_IDS } from '../modules/referral/ReferralReadOperations';
import { IdentityOperatorReportingModule } from '../modules/reporting/IdentityOperatorReportingModule';
import { REPORTING_OPERATOR_READ_OPERATION_IDS } from '../modules/reporting/ReportingReadOperations';
import { IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS } from '../modules/runtime/IdentityRegistrationRuntimeOperations';
import { IdentityRegistrationRuntimeModule } from '../modules/runtime/IdentityRegistrationRuntimeModule';
import { IdentityOperatorVoucherModule } from '../modules/voucher/05_interface_jieru/IdentityOperatorVoucherModule';
import { VOUCHER_OPERATOR_READ_OPERATION_IDS } from '../modules/voucher/03_application_yingyong/VoucherReadOperations';

const environment = identityRegistrationApiEnvironment();
const runtime = await createIdentityRegistrationApiRuntime(environment);
const identityOperationIds = runtime.wechatIdentityEnabled
  ? IDENTITY_REGISTRATION_OPERATION_IDS
  : IDENTITY_REGISTRATION_CORE_OPERATION_IDS;
const operationIds = Object.freeze([
  ...IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS,
  ...identityOperationIds,
  ...MEMBER_IDENTITY_OPERATOR_OPERATION_IDS,
  ...ACCESS_IDENTITY_OPERATOR_OPERATION_IDS,
  ...auditManifest.operations,
  ...FINANCE_OPERATOR_READ_OPERATION_IDS,
  ...REFERRAL_OPERATOR_READ_OPERATION_IDS,
  ...CHANNEL_OPERATOR_READ_OPERATION_IDS,
  ...VOUCHER_OPERATOR_READ_OPERATION_IDS,
  ...REPORTING_OPERATOR_READ_OPERATION_IDS,
  ...EXPERIENCE_OPERATOR_OPERATION_IDS,
  ...NOTIFICATION_OPERATOR_READ_OPERATION_IDS,
  ...QUALIFICATION_OPERATOR_READ_OPERATION_IDS,
]);
const bootstrapped = await bootstrapApi({
  modules: [
    IdentityRegistrationRuntimeModule,
    runtime.wechatIdentityEnabled ? IdentityRegistrationModule : IdentityRegistrationCoreModule,
    IdentityOperatorMemberModule,
    IdentityOperatorAccessModule,
    AuditModule,
    IdentityOperatorFinanceModule,
    IdentityOperatorReferralModule,
    IdentityOperatorChannelModule,
    IdentityOperatorVoucherModule,
    IdentityOperatorReportingModule,
    IdentityOperatorExperienceModule,
    IdentityOperatorNotificationModule,
    IdentityOperatorQualificationModule,
  ],
  operationIds,
  extensions: runtime.extensions,
  configure: runtime.configure,
  allowedOrigins: identityRegistrationApiAllowedOrigins(environment),
  telemetry: runtime.telemetry,
  runtimeNodeIds: [runtime.manifest.node_id],
});
const server = listen(bootstrapped.app, identityRegistrationApiPort(environment), '127.0.0.1', bootstrapped.nodeContextResolver);

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, async () => {
    await server.close();
    await runtime.close();
    process.exit(0);
  });
