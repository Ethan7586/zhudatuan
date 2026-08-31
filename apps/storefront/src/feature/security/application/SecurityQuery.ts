import { StorefrontQuery } from '../../../shared/api/Query';

export const securityQuery = (scope: string) => StorefrontQuery.security(scope);
