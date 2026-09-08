import { StorefrontQuery, type StorefrontScopedQueryIdentity } from '../../../shared/api/Query';

export const benefitAccountQuery = (identity: StorefrontScopedQueryIdentity) => Object.freeze([...StorefrontQuery.benefits(identity), 'accounts'] as const);
export const benefitLedgerQuery = (identity: StorefrontScopedQueryIdentity) => Object.freeze([...StorefrontQuery.benefits(identity), 'ledger'] as const);
