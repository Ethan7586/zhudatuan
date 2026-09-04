import { defineModule } from '../../../bootstrap/DefinedModule';
import { benefitOperations } from '../03_application_yingyong/BenefitOperations';
export const BenefitModule = defineModule('benefit', ['member', 'finance'], benefitOperations);
export { BenefitPort, type BenefitChoice, type BenefitRefund, type BenefitTender } from '../BenefitPort';
