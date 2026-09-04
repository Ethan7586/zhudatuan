import { describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Task } from '../model/Task';
import { taskCategory, taskDestination } from './TaskNavigation';

describe('task navigation presentation', () => {
  it.each([
    ['import', 'member', 'member', 'import'],
    ['export', 'reporting', 'report', 'export'],
    ['job', 'catalog', 'catalogsync', 'sync'],
    ['job', 'voucher', 'voucherissue', 'issuance'],
    ['job', 'finance', 'reconciliation', 'reconciliation'],
    ['job', 'runtime', 'cleanup', 'job'],
  ] as const)('classifies %s/%s/%s as %s', (type, owner, kind, category) => {
    expect(taskCategory(task(type, owner, kind))).toBe(category);
  });

  it('opens an import receipt and sends other tasks back to their source workspace', () => {
    expect(taskDestination(context, task('import', 'member', 'member'))).toEqual({
      path: '/scopes/enterprise/enterprise%3Aone/imports/member/import%3Aone',
      label: '查看任务收据',
    });
    expect(taskDestination(context, task('job', 'finance', 'reconciliation'))).toEqual({
      path: '/scopes/enterprise/enterprise%3Aone/finance/reconciliations',
      label: '返回来源页',
    });
  });
});

const scope = { kind: 'enterprise', id: 'enterprise:one', name: '测试集团' } as const;
const context = {
  scope,
  session: { scope },
} as ConsoleContext;

function task(type: Task['type'], owner: string, kind: string): Task {
  return {
    id: `${type}:one`, type, owner, kind, title: '测试任务', state: 'running', processed: 1, total: 2,
    succeeded: 1, failed: 0, retryableItems: 0, cancellable: true, retryable: false, version: 1,
    createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:01.000Z', expiresAt: null,
    fileName: null, downloadAvailable: false, confirmationRequired: false, previewHash: null, columns: [], validationErrors: 0,
  };
}
