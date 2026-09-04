import { defineModule } from '../../../bootstrap/DefinedModule';
import { reportingRoutes } from './http/ReportingRoutes';

export const ReportingModule = defineModule('reporting', [], reportingRoutes);
