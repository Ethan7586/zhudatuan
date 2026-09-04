import { defineModule } from '../bootstrap/DefinedModule';
import { runtimeOperations } from './runtime/RuntimeOperations';
export const RuntimeModule = defineModule('runtime', [], runtimeOperations);
