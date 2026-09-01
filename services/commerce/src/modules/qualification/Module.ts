import { PgCheckoutQualificationPort } from './infrastructure/persistence/PgCheckoutQualificationPort';
import { PgAfterSalePolicyPort } from './infrastructure/persistence/PgAfterSalePolicyPort';

import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { AFTERSALE_POLICY_PORT, CHECKOUT_QUALIFICATION_PORT } from './public';
import { CenterReadHandler } from './application/handler/CenterReadHandler';
import { DecisionsPreviewHandler } from './application/handler/DecisionsPreviewHandler';
import { PoliciesManageHandler } from './application/handler/PoliciesManageHandler';
import { PgQualificationRepository } from './infrastructure/persistence/PgQualificationRepository';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';

export const QualificationModule = defineModule(Manifest, {
  handlers: () => {
    const qualifications = new PgQualificationRepository(new PgTransactionAccess());
    return [new CenterReadHandler(qualifications), new DecisionsPreviewHandler(qualifications), new PoliciesManageHandler(qualifications)];
  },
  ports: [
    { token: CHECKOUT_QUALIFICATION_PORT, value: new PgCheckoutQualificationPort() },
    { token: AFTERSALE_POLICY_PORT, value: new PgAfterSalePolicyPort() },
  ],
});
