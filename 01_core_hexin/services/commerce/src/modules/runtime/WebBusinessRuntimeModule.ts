import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { WEB_BUSINESS_RUNTIME_OPERATION_IDS, webBusinessRuntimeOperations } from './WebBusinessRuntimeOperations';

export const WebBusinessRuntimeModule = defineSelectedModule(
  'runtime', WEB_BUSINESS_RUNTIME_OPERATION_IDS, webBusinessRuntimeOperations,
);
