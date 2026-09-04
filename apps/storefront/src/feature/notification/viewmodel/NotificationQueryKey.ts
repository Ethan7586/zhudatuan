import { StorefrontQuery, type StorefrontScopedQueryIdentity } from '../../../shared/api/Query';

export const notificationQuery = (identity: StorefrontScopedQueryIdentity) => StorefrontQuery.notifications(identity);
