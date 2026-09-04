import { defineModule } from '../../bootstrap/DefinedModule';
import { accessOperations } from './AccessOperations';
export const AccessModule = defineModule('access', ['identity', 'organization'], accessOperations);
export { AccessPort, accessPort } from './AccessPort';
