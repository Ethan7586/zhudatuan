import { PgCheckoutQualificationPort } from './infrastructure/persistence/PgCheckoutQualificationPort';
import { PgAfterSalePolicyPort } from './infrastructure/persistence/PgAfterSalePolicyPort';

import { defineModule } from '../../composition/DefinedModule';
import { Manifest } from './Manifest';
import { AFTERSALE_POLICY_PORT, CHECKOUT_QUALIFICATION_PORT } from './public';
import { CenterReadHandler } from './application/handler/CenterReadHandler';
import { DecisionsPreviewHandler } from './application/handler/DecisionsPreviewHandler';
import { PoliciesManageHandler } from './application/handler/PoliciesManageHandler';
import { PgQualificationRepository } from './infrastructure/persistence/PgQualificationRepository';
import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { PgQualificationCaseRepository } from './infrastructure/persistence/PgQualificationCaseRepository';
import { QualificationsPublishHandler } from './application/handler/QualificationsPublishHandler';
import { QualificationsRevokeHandler } from './application/handler/QualificationsRevokeHandler';
import { OBJECT_STORE } from '../runtime/public/ObjectPort';
import { PgJobScheduler } from '../../platform/database/PgJobScheduler';
import { createJobs } from './interface/job/JobFactory';
import { EvidenceUploadsCreateHandler } from './application/handler/EvidenceUploadsCreateHandler';
import { QualificationEvidence } from './application/service/QualificationEvidence';
import { CATALOG_QUALIFICATION_PORT } from './public/CatalogQualificationPort';
import { PgCatalogQualificationPort } from './infrastructure/persistence/PgCatalogQualificationPort';

export const QualificationModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const qualifications = new PgQualificationRepository(transactions);
    const cases = new PgQualificationCaseRepository(transactions);
    return [
      new CenterReadHandler(qualifications, cases),
      new DecisionsPreviewHandler(qualifications),
      new PoliciesManageHandler(qualifications),
      new QualificationsPublishHandler(cases, context.service(OBJECT_STORE), new PgJobScheduler(transactions)),
      new QualificationsRevokeHandler(cases),
      new EvidenceUploadsCreateHandler(new QualificationEvidence(context.service(OBJECT_STORE))),
    ];
  },
  ports: [
    { token: CHECKOUT_QUALIFICATION_PORT, value: new PgCheckoutQualificationPort() },
    { token: AFTERSALE_POLICY_PORT, value: new PgAfterSalePolicyPort() },
    { token: CATALOG_QUALIFICATION_PORT, value: new PgCatalogQualificationPort() },
  ],
  jobPorts: [{ token: CATALOG_QUALIFICATION_PORT, value: new PgCatalogQualificationPort() }],
});
