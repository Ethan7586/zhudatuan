import { defineModule } from '../../bootstrap/DefinedModule';
import { supportRoutes } from './interface/http/SupportRoutes';
import { Manifest } from './Manifest';
export type { SupportPort } from './application/port/SupportPort';
export const SupportModule = defineModule(Manifest, supportRoutes);
