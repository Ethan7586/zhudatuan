import { defineModule } from '../../bootstrap/DefinedModule';
import { reportingRoutes } from './interface/http/ReportingRoutes';
import { Manifest } from './Manifest';

export const ReportingModule = defineModule(Manifest, reportingRoutes);
