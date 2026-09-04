import { defineModule } from '../../../bootstrap/DefinedModule';
import { capabilityOperations } from '../03_application_yingyong/CapabilityOperations';
export const CapabilityModule = defineModule('capability', ['organization'], capabilityOperations);
