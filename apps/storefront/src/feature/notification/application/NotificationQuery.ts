import { StorefrontQuery } from '../../../shared/api/Query';

export const notificationQuery = (scope: string) => StorefrontQuery.notifications(scope);
