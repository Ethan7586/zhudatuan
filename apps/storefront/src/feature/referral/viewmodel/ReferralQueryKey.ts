import { StorefrontQuery, type StorefrontScopedQueryIdentity } from '../../../shared/api/Query';

export const referralQuery = (identity: StorefrontScopedQueryIdentity) => StorefrontQuery.referral(identity);
export const referralEarningsQuery = (identity: StorefrontScopedQueryIdentity) => Object.freeze([...referralQuery(identity), 'earnings'] as const);
export const referralWithdrawalsQuery = (identity: StorefrontScopedQueryIdentity) => Object.freeze([...referralQuery(identity), 'withdrawals'] as const);
