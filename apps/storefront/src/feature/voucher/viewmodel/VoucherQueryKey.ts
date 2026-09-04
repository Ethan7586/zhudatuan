import { StorefrontQuery, type StorefrontScopedQueryIdentity } from '../../../shared/api/Query';

export const voucherQuery = (identity: StorefrontScopedQueryIdentity, membership: string | null) => [...StorefrontQuery.vouchers(identity), membership] as const;
export const voucherDetailQuery = (identity: StorefrontScopedQueryIdentity, membership: string | null, voucher: string | null) => [...voucherQuery(identity, membership), 'detail', voucher] as const;
export const voucherTimelineQuery = (identity: StorefrontScopedQueryIdentity, membership: string | null, voucher: string | null) => [...voucherQuery(identity, membership), 'timeline', voucher] as const;
