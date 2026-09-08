import type { ImportRunnerPort } from '../../../runtime/public';
import type { ImportProcessPort } from '../port/ImportProcessPort';

export class InventoryImportProcess {
  constructor(
    private readonly runner: ImportRunnerPort,
    private readonly process: ImportProcessPort
  ) {}
  execute(id: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    return this.runner.execute('inventory', this.process, id, scope, signal, deadline);
  }
}
