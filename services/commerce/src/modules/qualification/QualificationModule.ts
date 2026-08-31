import { defineModule } from '../../bootstrap/DefinedModule';
import { qualificationOperations } from './QualificationOperations';
import { Manifest } from './Manifest';
import { AFTERSALE_POLICY_PORT, CHECKOUT_QUALIFICATION_PORT, PgAfterSalePolicyPort, PgCheckoutQualificationPort } from './public';
export const QualificationModule = defineModule(Manifest, qualificationOperations, [
  { token: CHECKOUT_QUALIFICATION_PORT, value: new PgCheckoutQualificationPort() },
  { token: AFTERSALE_POLICY_PORT, value: new PgAfterSalePolicyPort() },
]);
