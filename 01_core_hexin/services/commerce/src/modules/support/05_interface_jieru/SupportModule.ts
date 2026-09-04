import { defineModule } from '../../../bootstrap/DefinedModule';
import { supportRoutes } from './http/SupportRoutes';
export type { SupportPort } from '../01_public_gongkai/SupportPort';
export const SupportModule = defineModule('support', ['order', 'member', 'benefit'], supportRoutes);
