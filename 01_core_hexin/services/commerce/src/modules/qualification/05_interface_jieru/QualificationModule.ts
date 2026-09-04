import { defineModule } from '../../../bootstrap/DefinedModule';
import { qualificationOperations } from '../03_application_yingyong/QualificationOperations';
export const QualificationModule = defineModule('qualification', ['member'], qualificationOperations);
