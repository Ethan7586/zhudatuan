import { FinancePort } from '../finance';
import type { BenefitFinancePort } from './01_public_gongkai/BenefitPort';
import { BenefitPort as LayeredBenefitPort } from './04_adapters_shixian/BenefitPort';

export type { BenefitChoice, BenefitRefund, BenefitTender } from './01_public_gongkai/BenefitPort';

/** Legacy default wiring; the canonical root entry keeps Finance assembly out of its static closure. */
export class BenefitPort extends LayeredBenefitPort {
  constructor(finance: BenefitFinancePort = new FinancePort()) {
    super(finance);
  }
}
