import type { ImportRunnerPort } from '../../../runtime/public';
import type { ImportProcessPort } from '../port/ImportProcessPort';

export class OrderImportProcess {
  constructor(private readonly runner: ImportRunnerPort, private readonly process: ImportProcessPort) {}
  execute(id: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    return this.runner.execute('order', this.process, id, scope, signal, deadline);
  }
}
