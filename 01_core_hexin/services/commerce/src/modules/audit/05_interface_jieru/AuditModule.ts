import { defineModule } from '../../../bootstrap/DefinedModule';
import { auditRoutes } from './http/AuditRoutes';

export const AuditModule = defineModule('audit', [], auditRoutes);
