import { createFetchFinanceAuditRead, createFetchFinancePoliciesRead } from '@shop/sdk/finance';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { FinanceAuditPageSchema, FinancePolicyPageSchema } from './FinanceAuthoritySchema';

const policiesRead = createFetchFinancePoliciesRead(appConfig.apiBaseUrl);
const auditRead = createFetchFinanceAuditRead(appConfig.apiBaseUrl);

export interface FinanceAuthorityQuery {
  readonly cursor?: string;
  readonly limit: number;
}

export const financePoliciesKey = (context: ConsoleContext, query: FinanceAuthorityQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'finance.policies.read', query.cursor ?? null, query.limit] as const);

export const financeAuditKey = (context: ConsoleContext, query: FinanceAuthorityQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'finance.audit.read', query.cursor ?? null, query.limit] as const);

export async function readFinancePolicies(context: ConsoleContext, query: FinanceAuthorityQuery, signal: AbortSignal) {
  const value = await policiesRead({ query: operationQuery(query) }, consoleRequest(context.scope, signal, context.session.accessVersion));
  return FinancePolicyPageSchema.parse(value);
}

export async function readFinanceAudit(context: ConsoleContext, query: FinanceAuthorityQuery, signal: AbortSignal) {
  const value = await auditRead({ query: operationQuery(query) }, consoleRequest(context.scope, signal, context.session.accessVersion));
  return FinanceAuditPageSchema.parse(value);
}

function operationQuery(query: FinanceAuthorityQuery): Readonly<Record<string, string | number>> {
  return Object.freeze({ limit: query.limit, ...(query.cursor === undefined ? {} : { cursor: query.cursor }) });
}
