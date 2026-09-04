import { StorefrontQuery, type StorefrontScopedQueryIdentity } from '../../../shared/api/Query';

export const benefitQuery = (identity: StorefrontScopedQueryIdentity) => StorefrontQuery.benefits(identity);
