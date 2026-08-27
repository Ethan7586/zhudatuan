import { defineModule } from '../../bootstrap/DefinedModule';
import { supportRoutes } from './interface/http/SupportRoutes';
export type { SupportPort } from './application/port/SupportPort';
export const SupportModule = defineModule('support', ['order', 'member', 'benefit'], supportRoutes);
