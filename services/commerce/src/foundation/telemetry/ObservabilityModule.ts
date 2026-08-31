import { defineModule } from '../../bootstrap/DefinedModule';
import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
import { clientErrorOperations } from './ClientErrorOperations';

const Manifest = defineModuleManifest('observability', [], ['database.pool', 'audit.sink', 'telemetry']);
export const ObservabilityModule = defineModule(Manifest, clientErrorOperations);
