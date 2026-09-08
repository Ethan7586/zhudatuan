import { StorefrontQuery, type StorefrontScopedQueryIdentity } from '../../../shared/api/Query';

export const notificationQuery = (identity: StorefrontScopedQueryIdentity) => StorefrontQuery.notifications(identity);
export const notificationItemsQuery = (identity: StorefrontScopedQueryIdentity) => Object.freeze([...notificationQuery(identity), 'items'] as const);
export const notificationPreferenceQuery = (identity: StorefrontScopedQueryIdentity) => Object.freeze([...notificationQuery(identity), 'preferences'] as const);
