import { defineModule } from '../../bootstrap/DefinedModule';
import { riskRoutes } from './interface/http/RiskRoutes';
export const RiskModule = defineModule('risk', [], riskRoutes);
