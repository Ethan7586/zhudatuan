import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import type { Task } from '../model/Task';

export type TaskCategory = 'import' | 'export' | 'sync' | 'issuance' | 'reconciliation' | 'job';

export interface TaskDestination {
  readonly path: string;
  readonly label: string;
}

const syncKinds = new Set(['catalogsync', 'pricesync', 'inventorysync', 'statementsync', 'directorysync']);
const issuanceKinds = new Set(['benefitgrant', 'voucherissue']);

export function taskCategory(task: Task): TaskCategory {
  if (task.type === 'import') return 'import';
  if (task.type === 'export') return 'export';
  if (syncKinds.has(task.kind)) return 'sync';
  if (issuanceKinds.has(task.kind)) return 'issuance';
  if (task.kind === 'reconciliation') return 'reconciliation';
  return 'job';
}

export function taskDestination(context: ConsoleContext, task: Task): TaskDestination {
  if (task.type === 'import') return Object.freeze({
    path: scopeRoutePath(context.scope, 'consoleimporttask', { kind: task.owner, jobId: task.id }),
    label: '查看任务收据',
  });
  return Object.freeze({ path: taskSourcePath(context, task), label: '返回来源页' });
}

export function taskSourcePath(context: ConsoleContext, task: Task): string {
  if (task.owner === 'member') return scopeRoutePath(context.scope, 'consolemembers');
  if (task.owner === 'catalog' || task.owner === 'inventory') return scopeRoutePath(context.scope, 'consoleproducts');
  if (task.owner === 'order') return scopeRoutePath(context.scope, 'consoleorders');
  if (task.owner === 'finance') return scopeRoutePath(context.scope, 'consolefinancereconciliation');
  if (task.owner === 'voucher') return scopeRoutePath(context.scope, 'consolevouchers');
  if (task.owner === 'reporting') return scopeRoutePath(context.scope, 'consolereporting');
  if (task.owner === 'channel') return scopeRoutePath(context.scope, 'consolechannels');
  if (task.owner === 'approval') return scopeRoutePath(context.scope, 'consoleapprovals');
  return scopeRoutePath(context.scope, 'consoletasks');
}
