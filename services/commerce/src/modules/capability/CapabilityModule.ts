import { defineModule } from '../../bootstrap/DefinedModule';
import { capabilityOperations } from './CapabilityOperations';
import { Manifest } from './Manifest';
import { CapabilityPort } from './CapabilityPort';
import { CHANNEL_CAPABILITY_PORT } from './public/index';
import { NAVIGATION_CAPABILITY_PORT } from './public/NavigationCapabilityPort';
import { PgNavigationCapability } from './infrastructure/PgNavigationCapability';
export const CapabilityModule = defineModule(Manifest, capabilityOperations, [
  { token: CHANNEL_CAPABILITY_PORT, value: new CapabilityPort() },
  { token: NAVIGATION_CAPABILITY_PORT, value: new PgNavigationCapability() },
]);
