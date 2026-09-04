import { defineModule } from '../../../bootstrap/DefinedModule';
import { experienceOperations } from '../03_application_yingyong/ExperienceOperations';
export const ExperienceModule = defineModule('experience', ['catalog'], experienceOperations);
export { ExperienceProvisioningPort, experienceProvisioningPort } from '../01_public_gongkai/ExperienceProvisioningPort';
