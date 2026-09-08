import type { BatchImportProcessPort, ImportRunnerPort } from '../../../runtime/public';

export class CredentialImportProcess {
  constructor(
    private readonly runner: ImportRunnerPort,
    private readonly process: BatchImportProcessPort
  ) {}
  execute(id: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    return this.runner.execute('voucher', this.process, id, scope, signal, deadline);
  }
}
