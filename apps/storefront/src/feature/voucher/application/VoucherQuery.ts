import { StorefrontQuery } from '../../../shared/api/Query';

export const voucherQuery = (scope: string) => StorefrontQuery.vouchers(scope);
