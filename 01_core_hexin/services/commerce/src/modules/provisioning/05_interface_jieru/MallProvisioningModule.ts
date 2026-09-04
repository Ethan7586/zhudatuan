import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import { MALL_PROVISIONING_OPERATION_IDS, provisioningOperations } from '../03_application_yingyong/ProvisioningOperations';

export const MallProvisioningModule = defineSelectedModule(
  'provisioning',
  MALL_PROVISIONING_OPERATION_IDS,
  provisioningOperations,
);
