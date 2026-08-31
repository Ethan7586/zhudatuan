import { defineModule } from '../../bootstrap/DefinedModule';
import { runtimeOperations } from './runtime/RuntimeOperations';
import { Manifest } from './runtime/Manifest';
export const RuntimeModule = defineModule(Manifest, runtimeOperations);
