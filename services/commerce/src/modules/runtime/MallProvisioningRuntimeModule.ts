import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import {
  MALL_PROVISIONING_RUNTIME_OPERATION_IDS,
  mallProvisioningRuntimeOperations,
} from './MallProvisioningRuntimeOperations';

export const MallProvisioningRuntimeModule = defineSelectedModule(
  'runtime',
  MALL_PROVISIONING_RUNTIME_OPERATION_IDS,
  mallProvisioningRuntimeOperations,
);
