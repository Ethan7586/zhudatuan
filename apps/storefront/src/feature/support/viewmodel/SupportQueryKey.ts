import { StorefrontQuery, type StorefrontScopedQueryIdentity } from '../../../shared/api/Query';

export const supportQuery = (identity: StorefrontScopedQueryIdentity, caseId?: string) => StorefrontQuery.support(identity, caseId);
