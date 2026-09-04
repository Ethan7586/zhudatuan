import { FinancePort } from '../finance';
import type { VoucherFinancePort } from './01_public_gongkai/VoucherPort';
import { VoucherPort as LayeredVoucherPort } from './04_adapters_shixian/VoucherPort';

export type {
  VoucherChoice,
  VoucherDatabase,
  VoucherFinancePort,
  VoucherGateway,
  VoucherRedemption,
  VoucherRefund,
  VoucherTender,
} from './01_public_gongkai/VoucherPort';

/** Legacy default wiring; the canonical root entry keeps Finance assembly out of its static closure. */
export class VoucherPort extends LayeredVoucherPort {
  constructor(finance: VoucherFinancePort = new FinancePort()) {
    super(finance);
  }
}
