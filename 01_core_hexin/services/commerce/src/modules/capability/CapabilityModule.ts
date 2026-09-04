import { defineModule } from '../../bootstrap/DefinedModule';
import { capabilityOperations } from './CapabilityOperations';
export const CapabilityModule = defineModule('capability', ['organization'], capabilityOperations);
export { CapabilityPort, capabilityPort } from './CapabilityPort';
