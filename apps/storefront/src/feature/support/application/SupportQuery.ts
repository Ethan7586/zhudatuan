import { StorefrontQuery } from '../../../shared/api/Query';

export const supportQuery = (scope: string, caseId?: string) => StorefrontQuery.support(scope, caseId);
