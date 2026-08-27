import { defineModule } from '../../bootstrap/DefinedModule';
import { auditRoutes } from './interface/http/AuditRoutes';

export const AuditModule = defineModule('audit', [], auditRoutes);
