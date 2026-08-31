import { defineModule } from '../../bootstrap/DefinedModule';
import { auditRoutes } from './interface/http/AuditRoutes';
import { Manifest } from './Manifest';

export const AuditModule = defineModule(Manifest, auditRoutes);
