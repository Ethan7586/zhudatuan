import { defineModule } from '../../bootstrap/DefinedModule';
import { voucherOperations } from './VoucherOperations';
export const VoucherModule = defineModule('voucher', ['member', 'finance'], voucherOperations);
export { VoucherPort, type VoucherChoice, type VoucherRefund, type VoucherTender } from './VoucherPort';
