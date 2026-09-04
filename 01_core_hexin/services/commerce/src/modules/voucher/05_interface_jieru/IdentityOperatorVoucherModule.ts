import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import { VOUCHER_OPERATOR_READ_OPERATION_IDS, voucherOperatorReadOperations } from '../03_application_yingyong/VoucherReadOperations';

export const IdentityOperatorVoucherModule = defineSelectedModule(
  'voucher', VOUCHER_OPERATOR_READ_OPERATION_IDS, voucherOperatorReadOperations, ['identity'],
);
