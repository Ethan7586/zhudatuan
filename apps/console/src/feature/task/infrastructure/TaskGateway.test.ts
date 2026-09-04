import type { RuntimeOperations } from '@shop/sdk/runtime';
import { describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Task } from '../model/Task';
import { TaskGateway } from './TaskGateway';

describe('TaskGateway', () => {
  it('uses the unified runtime contract for Job, Import and Export reads and commands', async () => {
    const dto = taskDto();
    const runtime = {
      jobsRead: vi.fn(() => Promise.resolve({ items: [dto], count: 1 })),
      importsRead: vi.fn(() => Promise.resolve(dto)),
      exportsRead: vi.fn(() => Promise.resolve({ ...dto, id: 'export:one', type: 'export' })),
      jobsCancel: vi.fn(() => Promise.resolve({ ...dto, state: 'cancelled', version: 3 })),
      exportsCancel: vi.fn(() => Promise.resolve({ ...dto, id: 'export:one', type: 'export', state: 'cancelled', version: 3 })),
      importsRetry: vi.fn(() => Promise.resolve({ ...dto, state: 'queued', version: 3 })),
      importsConfirm: vi.fn(() => Promise.resolve({ ...dto, state: 'running', version: 3 })),
    } as unknown as RuntimeOperations;
    const gateway = new TaskGateway('https://api.example.invalid', { runtime });
    const imported = task();
    const exported = { ...imported, id: 'export:one', type: 'export' as const };

    expect((await gateway.list(context, { limit: 20 })).items).toHaveLength(1);
    expect((await gateway.read(context, 'import', imported.id)).type).toBe('import');
    expect((await gateway.read(context, 'export', exported.id)).type).toBe('export');
    expect((await gateway.cancel(context, imported, '停止异常文件', 'command:cancel')).state).toBe('cancelled');
    expect((await gateway.cancel(context, exported, '停止导出', 'command:export')).type).toBe('export');
    expect((await gateway.retry(context, imported, '重试失败行', 'command:retry')).state).toBe('queued');
    expect((await gateway.confirm(context, imported, 'command:confirm')).state).toBe('running');
    expect(runtime.jobsRead).toHaveBeenCalledOnce();
    expect(runtime.importsRead).toHaveBeenCalledOnce();
    expect(runtime.exportsRead).toHaveBeenCalledOnce();
    expect(runtime.jobsCancel).toHaveBeenCalledOnce();
    expect(runtime.exportsCancel).toHaveBeenCalledOnce();
    expect(runtime.importsRetry).toHaveBeenCalledOnce();
    expect(runtime.importsConfirm).toHaveBeenCalledOnce();
  });
});

const context = { scope: { kind: 'enterprise', id: 'enterprise:one' }, session: { accessVersion: 4, csrf: 'csrf-token' } } as ConsoleContext;
function task(): Task { return { id: 'import:one', type: 'import', owner: 'member', kind: 'member', title: '成员导入', state: 'ready', processed: 10, total: 10, succeeded: 9, failed: 1, retryableItems: 1, cancellable: true, retryable: true, version: 2, createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:01:00.000Z', expiresAt: null, fileName: 'members.csv', downloadAvailable: true, confirmationRequired: true, previewHash: 'preview:one', columns: ['mobile'], validationErrors: 0 }; }
function taskDto() { const value = task(); return value; }
