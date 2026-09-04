import { defineModule } from '../../../bootstrap/DefinedModule';
import { riskRoutes } from './http/RiskRoutes';
export const RiskModule = defineModule('risk', [], riskRoutes);
