import { defineModule } from '../../bootstrap/DefinedModule';
import { qualificationOperations } from './QualificationOperations';
export const QualificationModule = defineModule('qualification', ['member'], qualificationOperations);
