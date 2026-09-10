import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import type { ProductRestockStage, ProductRestockWorkflow } from '../../feature/product/application/RestockProduct';
import type { ConfirmImport } from '../../feature/task/application/ConfirmImport';
import type { CreateImport } from '../../feature/task/application/CreateImport';
import type { ReadTasks } from '../../feature/task/application/ReadTasks';
import { emptyImportDraft } from '../../feature/task/model/ImportDraft';
import type { Task } from '../../feature/task/model/Task';

export class InventoryRestockWorkflow implements ProductRestockWorkflow {
  constructor(
    private readonly create: Pick<CreateImport, 'execute'>,
    private readonly read: Pick<ReadTasks, 'read'>,
    private readonly confirm: Pick<ConfirmImport, 'execute'>,
    readonly createIdentity: () => string,
    private readonly pause: (milliseconds: number, signal?: AbortSignal) => Promise<void> = wait,
    private readonly attempts = 120
  ) {}

  async execute(context: ConsoleContext, file: File, identity: string, progress?: (stage: ProductRestockStage) => void, signal?: AbortSignal): Promise<void> {
    const draft = Object.freeze({ ...emptyImportDraft('inventory'), step: 3 as const, file, confirmed: true });
    let task = await this.create.execute(context, draft, identity, signal);

    progress?.('validating');
    task = await this.until(context, task, (current) => current.state === 'ready' || terminal(current), signal);
    if (task.state === 'completed') return;
    assertReady(task);

    progress?.('applying');
    task = await this.confirm.execute(context, task, this.createIdentity(), signal);
    task = await this.until(context, task, (current) => current.state === 'completed' || terminal(current), signal);
    if (task.state !== 'completed') throw taskFailure(task);
  }

  private async until(context: ConsoleContext, initial: Task, done: (task: Task) => boolean, signal?: AbortSignal): Promise<Task> {
    let task = initial;
    for (let attempt = 0; attempt < this.attempts; attempt += 1) {
      if (done(task)) return task;
      await this.pause(500, signal);
      task = await this.read.read(context, 'import', task.id, signal);
    }
    throw new Error('库存处理时间较长，请稍后重试；本次填写内容已保留。');
  }
}

function terminal(task: Task): boolean {
  return task.state === 'completed' || task.state === 'failed' || task.state === 'cancelled' || task.state === 'expired';
}

function assertReady(task: Task): void {
  if (task.state !== 'ready') throw taskFailure(task);
  if (task.validationErrors > 0) throw new Error('库存信息校验未通过，请检查数量后重试；本次填写内容已保留。');
  if (!task.confirmationRequired || task.previewHash === null) throw new Error('库存预检结果不完整，请稍后重试；本次填写内容已保留。');
}

function taskFailure(task: Task): Error {
  if (task.state === 'cancelled') return new Error('库存处理已取消，请重新提交。');
  if (task.state === 'expired') return new Error('库存处理已超时，请重新提交。');
  return new Error('库存处理未完成，请检查网络后重试；本次填写内容已保留。');
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('操作已取消', 'AbortError'));
      return;
    }
    const finish = () => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    const cancel = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException('操作已取消', 'AbortError'));
    };
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
