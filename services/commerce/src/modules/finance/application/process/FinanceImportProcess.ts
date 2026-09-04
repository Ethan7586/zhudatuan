import type { BatchImportProcessPort, ImportRunnerPort } from '../../../runtime/public';

/** Coordinates the Finance-owned validator/publisher through Runtime's resumable import runner. */
export class FinanceImportProcess {
  constructor(
    private readonly runner: ImportRunnerPort,
    private readonly process: BatchImportProcessPort
  ) {}

  execute(id: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    return this.runner.execute('finance', this.process, id, scope, signal, deadline);
  }
}
