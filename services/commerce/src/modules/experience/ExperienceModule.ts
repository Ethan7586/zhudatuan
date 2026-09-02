import { defineModule } from '../../bootstrap/DefinedModule';
import { experienceOperations } from './ExperienceOperations';
export const ExperienceModule = defineModule('experience', ['catalog'], experienceOperations);
export { ExperienceProvisioningPort, experienceProvisioningPort } from './ExperienceProvisioningPort';
