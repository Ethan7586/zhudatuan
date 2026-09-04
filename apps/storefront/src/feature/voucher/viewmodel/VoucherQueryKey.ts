import { StorefrontQuery, type StorefrontScopedQueryIdentity } from '../../../shared/api/Query';

export const voucherQuery = (identity: StorefrontScopedQueryIdentity) => StorefrontQuery.vouchers(identity);
