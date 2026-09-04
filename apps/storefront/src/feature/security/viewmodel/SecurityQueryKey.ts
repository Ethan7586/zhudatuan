import { StorefrontQuery, type StorefrontScopedQueryIdentity } from '../../../shared/api/Query';

export const securityQuery = (identity: StorefrontScopedQueryIdentity) => StorefrontQuery.security(identity);
