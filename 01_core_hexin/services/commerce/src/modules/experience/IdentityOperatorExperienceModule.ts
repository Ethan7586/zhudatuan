import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { EXPERIENCE_OPERATOR_OPERATION_IDS, experienceOperatorOperations } from './ExperienceOperatorOperations';

export const IdentityOperatorExperienceModule = defineSelectedModule('experience', EXPERIENCE_OPERATOR_OPERATION_IDS, experienceOperatorOperations, ['identity']);
