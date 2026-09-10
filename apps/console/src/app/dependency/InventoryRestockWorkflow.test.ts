import { describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import type { Task } from '../../feature/task/model/Task';
import { InventoryRestockWorkflow } from './InventoryRestockWorkflow';

describe('InventoryRestockWorkflow', () => {
  it('creates, validates and confirms an inventory task', async () => {
    const create = vi.fn(async () => task('queued', 1));
    const read = vi
      .fn()
      .mockResolvedValueOnce(task('ready', 2, { confirmationRequired: true, previewHash: 'preview:one' }))
      .mockResolvedValueOnce(task('completed', 4));
    const confirm = vi.fn(async () => task('running', 3));
    const stages: string[] = [];
    let identity = 1;
    const workflow = new InventoryRestockWorkflow(
      { execute: create },
      { read },
      { execute: confirm },
      () => `command:${++identity}`,
      async () => undefined
    );

    await workflow.execute(context, new File(['inventory'], 'inventory.csv'), 'command:1', (stage) => stages.push(stage));

    expect(stages).toEqual(['validating', 'applying']);
    expect(create).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('stops before confirmation when server validation rejects the row', async () => {
    const confirm = vi.fn();
    const workflow = new InventoryRestockWorkflow(
      { execute: vi.fn(async () => task('ready', 2, { confirmationRequired: true, previewHash: 'preview:bad', validationErrors: 1 })) },
      { read: vi.fn() },
      { execute: confirm },
      () => 'command:two',
      async () => undefined
    );

    await expect(workflow.execute(context, new File(['inventory'], 'inventory.csv'), 'command:one')).rejects.toThrow('库存信息校验未通过');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('stops polling when the operation is cancelled', async () => {
    const read = vi.fn();
    const controller = new AbortController();
    controller.abort(new DOMException('操作已取消', 'AbortError'));
    const workflow = new InventoryRestockWorkflow({ execute: vi.fn(async () => task('queued', 1)) }, { read }, { execute: vi.fn() }, () => 'command:two');

    await expect(workflow.execute(context, new File(['inventory'], 'inventory.csv'), 'command:one', undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(read).not.toHaveBeenCalled();
  });
});

const scope = { kind: 'mall', id: 'mall:one', tenant: 'tenant:one' } as const;
const context = {
  scope,
  scopes: [scope],
  profile: { display_name: '测试用户', employee_no: null },
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    scope,
    scopes: [scope],
    accessVersion: 1,
    permissions: [],
    capabilities: [],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    target: 'console',
    csrf: 'csrf:one',
    syncedAt: '2026-09-10T00:00:00.000Z',
  },
} satisfies ConsoleContext;

function task(state: Task['state'], version: number, overrides: Partial<Task> = {}): Task {
  return Object.freeze({
    id: 'import:inventory:one',
    type: 'import',
    owner: 'inventory',
    kind: 'inventory',
    title: '库存导入',
    state,
    processed: 0,
    total: 1,
    succeeded: 0,
    failed: 0,
    retryableItems: 0,
    cancellable: false,
    retryable: false,
    version,
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    expiresAt: null,
    fileName: '单品补库存.csv',
    downloadAvailable: false,
    confirmationRequired: false,
    previewHash: null,
    columns: ['sku', 'location', 'onhand', 'safety'],
    validationErrors: 0,
    ...overrides,
  });
}
