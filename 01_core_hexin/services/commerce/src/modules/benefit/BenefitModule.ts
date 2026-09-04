import { defineModule } from '../../bootstrap/DefinedModule';
import { benefitOperations } from './BenefitOperations';
export const BenefitModule = defineModule('benefit', ['member', 'finance'], benefitOperations);
export { BenefitPort, type BenefitChoice, type BenefitRefund, type BenefitTender } from './BenefitPort';
