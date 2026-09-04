import { defineModule } from '../../../bootstrap/DefinedModule';
import { voucherOperations } from '../03_application_yingyong/VoucherOperations';
export const VoucherModule = defineModule('voucher', ['member', 'finance'], voucherOperations);
export { VoucherPort, type VoucherChoice, type VoucherRefund, type VoucherTender } from '../VoucherPort';
