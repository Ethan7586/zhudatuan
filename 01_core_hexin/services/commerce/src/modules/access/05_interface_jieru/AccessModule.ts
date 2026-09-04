import { defineModule } from '../../../bootstrap/DefinedModule';
import { accessOperations } from '../03_application_yingyong/AccessOperations';
export const AccessModule = defineModule('access', ['identity', 'organization'], accessOperations);
export { AccessPort, accessPort } from '../01_public_gongkai/AccessPort';
