import {
  createFetchSupportAccountsRead,
  createFetchSupportAgentsRead,
  createFetchSupportCasesRead,
  createFetchSupportHistoryRead,
  createFetchSupportMessagesRead,
  createFetchSupportRulesRead,
  createFetchSupportSlasRead,
} from '@shop/sdk/support';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { SupportAccountPageSchema, SupportAgentPageSchema, SupportCasePageSchema, SupportHistoryPageSchema, SupportMessagePageSchema, SupportRulePageSchema, SupportSlaPageSchema } from './SupportSchema';

const casesRead = createFetchSupportCasesRead(appConfig.apiBaseUrl);
const messagesRead = createFetchSupportMessagesRead(appConfig.apiBaseUrl);
const historyRead = createFetchSupportHistoryRead(appConfig.apiBaseUrl);
const agentsRead = createFetchSupportAgentsRead(appConfig.apiBaseUrl);
const accountsRead = createFetchSupportAccountsRead(appConfig.apiBaseUrl);
const rulesRead = createFetchSupportRulesRead(appConfig.apiBaseUrl);
const slasRead = createFetchSupportSlasRead(appConfig.apiBaseUrl);

export type SupportView = 'cases' | 'rules' | 'agents' | 'accounts' | 'slas';
export interface SupportAdminRow {
  readonly id: string;
  readonly primary: string;
  readonly secondary: string;
  readonly metric: string;
  readonly state: string;
  readonly version: number | null;
  readonly updated: string | null;
}

export const supportCaseKey = (context: ConsoleContext, cursor?: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'support.cases.read', cursor ?? null, 50] as const);
export const supportMessageKey = (context: ConsoleContext, caseId: string, cursor?: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'support.messages.read', caseId, cursor ?? null, 200] as const);
export const supportHistoryKey = (context: ConsoleContext, caseId: string, cursor?: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'support.history.read', caseId, cursor ?? null, 200] as const);
export const supportAdminKey = (context: ConsoleContext, view: SupportView, cursor?: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, `support.${view}.read`, cursor ?? null, 50] as const);

export async function readCases(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  return SupportCasePageSchema.parse(await casesRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
export async function readMessages(context: ConsoleContext, caseId: string, cursor: string | undefined, signal: AbortSignal) {
  return SupportMessagePageSchema.parse(await messagesRead({ path: { caseid: caseId }, query: { limit: 200, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
export async function readHistory(context: ConsoleContext, caseId: string, cursor: string | undefined, signal: AbortSignal) {
  return SupportHistoryPageSchema.parse(await historyRead({ path: { caseid: caseId }, query: { limit: 200, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
export async function readSupportAdmin(context: ConsoleContext, view: Exclude<SupportView, 'cases'>, cursor: string | undefined, signal: AbortSignal) {
  const input = { query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } };
  const request = consoleRequest(context.scope, signal, context.session.accessVersion);
  if (view === 'agents') {
    const page = SupportAgentPageSchema.parse(await agentsRead(input, request));
    return mapPage(page, (row) => ({ id: row.id, primary: row.membership_id, secondary: row.skills.join('、') || '未设置技能', metric: `容量 ${row.capacity}`, state: row.state, version: null, updated: null }));
  }
  if (view === 'accounts') {
    const page = SupportAccountPageSchema.parse(await accountsRead(input, request));
    return mapPage(page, (row) => ({ id: row.id, primary: row.external_ref, secondary: row.channel, metric: '渠道账号', state: row.state, version: row.version, updated: null }));
  }
  if (view === 'rules') {
    const page = SupportRulePageSchema.parse(await rulesRead(input, request));
    return mapPage(page, (row) => ({ id: row.id, primary: row.name, secondary: `${row.skill} · ${row.priorities.join('、')}`, metric: `权重 ${row.weight}`, state: row.state, version: row.version, updated: row.updated_at }));
  }
  const page = SupportSlaPageSchema.parse(await slasRead(input, request));
  return mapPage(page, (row) => ({
    id: row.id,
    primary: `${row.priority} 优先级`,
    secondary: `响应 ${duration(row.response_seconds)}`,
    metric: `解决 ${duration(row.resolution_seconds)}`,
    state: 'active',
    version: row.version,
    updated: null,
  }));
}

function mapPage<T>(page: Readonly<{ items: readonly T[]; count: number; nextCursor?: string | undefined }>, map: (row: T) => SupportAdminRow) {
  return Object.freeze({ items: Object.freeze(page.items.map(map)), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
}
function duration(seconds: number): string {
  return seconds < 3600 ? `${Math.ceil(seconds / 60)} 分钟` : `${Math.ceil(seconds / 3600)} 小时`;
}
