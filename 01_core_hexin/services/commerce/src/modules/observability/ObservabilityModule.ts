import { defineModule } from '../../bootstrap/DefinedModule';
import { clientErrorOperations } from '../../foundation/telemetry/ClientErrorOperations';

export const ObservabilityModule = defineModule('observability', [], clientErrorOperations);
