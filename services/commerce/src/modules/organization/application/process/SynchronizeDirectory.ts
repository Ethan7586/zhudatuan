import type { DirectoryLease } from '../port/DirectoryJobRepository';
import type { DirectorySyncService } from '../service/DirectorySyncService';

export interface DirectorySyncExecution {
  readonly trace: string;
  readonly attempts: number;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class SynchronizeDirectory {
  constructor(
    private readonly leases: DirectoryLease,
    private readonly service: DirectorySyncService,
    private readonly leaseSeconds: number,
    private readonly maximumAttempts: number
  ) {}

  execute(connection: string, run: string, execution: DirectorySyncExecution): Promise<void> {
    return this.leases.run(`directory:${connection}`, execution.trace, this.leaseSeconds, async (assertLease) => {
      try {
        await this.service.execute(connection, run, execution.trace, execution.signal, execution.deadline, assertLease);
      } catch (cause) {
        if (execution.attempts >= this.maximumAttempts && !execution.signal.aborted && execution.deadline > Date.now()) {
          await this.service.fail(run, cause, execution.trace, execution.signal, execution.deadline);
        }
        throw cause;
      }
    });
  }
}
